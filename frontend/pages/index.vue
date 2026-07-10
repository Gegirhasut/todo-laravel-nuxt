<template>
  <div class="container">
    <div class="page-head">
      <div>
        <h1 class="page-title">Задачи</h1>
        <p class="muted page-sub">{{ subtitle }}</p>
      </div>
      <button class="btn-primary" @click="openCreate">+ Новая задача</button>
    </div>

    <!-- Admins always see everything, so the switch is only for regular users. -->
    <div v-if="!auth.isAdmin" class="scope-switch" role="group" aria-label="Чьи задачи показывать">
      <button
        class="scope-btn"
        :class="{ active: scope === 'mine' }"
        :aria-pressed="scope === 'mine'"
        @click="scope = 'mine'"
      >
        Мои задачи
      </button>
      <button
        class="scope-btn"
        :class="{ active: scope === 'all' }"
        :aria-pressed="scope === 'all'"
        @click="scope = 'all'"
      >
        Все задачи
      </button>
    </div>

    <div class="toolbar card">
      <input
        v-model="searchInput"
        type="search"
        class="toolbar-search"
        placeholder="Поиск задач…"
        aria-label="Поиск задач"
      >

      <select v-model="statusFilter" aria-label="Фильтр по статусу">
        <option value="">Все статусы</option>
        <option v-for="option in TASK_STATUSES" :key="option" :value="option">
          {{ statusLabel(option) }}
        </option>
      </select>

      <select v-model="sortValue" aria-label="Сортировка">
        <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div v-if="store.loading" class="state">
      <span class="spinner spinner-dark" /> Загрузка задач…
    </div>

    <div v-else-if="store.error" class="alert-error state-block" role="alert">
      {{ store.error }}
      <button class="btn-ghost btn-sm retry" @click="reload">Повторить</button>
    </div>

    <div v-else-if="store.isEmpty" class="state empty card">
      <p class="empty-title">Задачи не найдены</p>
      <p class="muted empty-sub">{{ emptyHint }}</p>
    </div>

    <!-- While a create/edit/delete re-syncs, the rows stay put and simply dim. -->
    <div v-else class="task-list-wrap">
      <div class="task-list" :class="{ refreshing: store.refreshing }">
        <TaskRow
          v-for="task in store.items"
          :key="task.id"
          :task="task"
          :highlighted="task.id === createdId"
          :show-owner="listHasSeveralOwners"
          @edit="openEdit"
          @delete="askDelete"
        />
      </div>

      <div v-if="store.refreshing" class="refresh-badge" role="status">
        <span class="spinner spinner-dark" /> Обновление…
      </div>
    </div>

    <AppPagination v-if="!store.loading && !store.error" :meta="store.meta" @change="goToPage" />

    <TaskFormModal
      v-if="showModal"
      :task="editing"
      @close="closeModal"
      @saved="onSaved"
    />

    <div v-if="deleting" class="overlay" @click.self="deleting = null">
      <div class="card confirm" role="dialog" aria-modal="true">
        <h3 class="confirm-title">Удалить задачу?</h3>
        <p class="muted">«{{ deleting.title }}» будет удалена безвозвратно.</p>

        <div v-if="deleteError" class="alert-error confirm-alert" role="alert">
          {{ deleteError }}
        </div>

        <div class="confirm-actions">
          <button class="btn-ghost" :disabled="deleteBusy" @click="deleting = null">Отмена</button>
          <button class="btn-danger" :disabled="deleteBusy" @click="confirmDelete">
            <span v-if="deleteBusy" class="spinner spinner-dark" />
            Удалить
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SortColumn, SortDirection, Task, TaskQuery, TaskScope, TaskStatus } from '~/types'

definePageMeta({ middleware: 'auth' })

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Сначала новые' },
  { value: 'created_at:asc', label: 'Сначала старые' },
  { value: 'due_date:asc', label: 'Срок ↑' },
  { value: 'due_date:desc', label: 'Срок ↓' },
  { value: 'status:asc', label: 'По статусу' },
  { value: 'title:asc', label: 'По названию, А–Я' },
] as const

const DEFAULT_SORT = 'created_at:desc'
const SEARCH_DEBOUNCE_MS = 350
const HIGHLIGHT_MS = 2000

const auth = useAuthStore()
const store = useTasksStore()
const toasts = useToastsStore()
const route = useRoute()
const router = useRouter()

function queryString(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

// The URL is the single source of truth for the list controls, so a page can
// be shared, bookmarked and survive a refresh.
const searchInput = ref(queryString('search'))
const statusFilter = ref(queryString('status'))
const sortValue = ref(currentSort())
const scope = ref<TaskScope>(currentScope())

const hasActiveFilters = computed(() => !!queryString('search') || !!queryString('status'))

// An admin's list always mixes owners; a regular user's only does in "all" mode.
const listHasSeveralOwners = computed(() => auth.isAdmin || scope.value === 'all')

const emptyHint = computed(() => {
  if (hasActiveFilters.value) return 'Попробуйте изменить поиск или сбросить фильтр.'
  if (listHasSeveralOwners.value) return 'Пока никто не создал ни одной задачи.'
  return 'Создайте первую задачу, чтобы начать.'
})

const subtitle = computed(() => {
  if (auth.isAdmin) return 'Показаны задачи всех пользователей.'
  return scope.value === 'all'
    ? 'Показаны задачи всех пользователей. Чужие задачи доступны только для чтения.'
    : 'Ваши задачи.'
})

function currentScope(): TaskScope {
  return queryString('scope') === 'all' ? 'all' : 'mine'
}

function currentSort(): string {
  const sort = queryString('sort')
  const direction = queryString('direction')
  const candidate = `${sort}:${direction}`

  return SORT_OPTIONS.some((option) => option.value === candidate) ? candidate : DEFAULT_SORT
}

/** Turn the current URL query into the parameters the API expects. */
function apiQuery(): TaskQuery {
  const [sort, direction] = currentSort().split(':') as [SortColumn, SortDirection]

  return {
    search: queryString('search') || undefined,
    status: (queryString('status') as TaskStatus) || undefined,
    // 'mine' is the server default, so it never needs to travel.
    scope: currentScope() === 'all' ? 'all' : undefined,
    sort,
    direction,
    page: Number(queryString('page')) || undefined,
  }
}

/** Merge a patch into the URL query; empty values drop the key entirely. */
function pushQuery(patch: Record<string, string | number | undefined>, resetPage = true) {
  const next: Record<string, string> = { ...(route.query as Record<string, string>) }

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') delete next[key]
    else next[key] = String(value)
  }

  // Any change to search/filter/sort invalidates the current page number.
  if (resetPage) delete next.page

  router.replace({ query: next })
}

// Debounce the search box so we don't hit the API on every keystroke.
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => pushQuery({ search: value.trim() || undefined }), SEARCH_DEBOUNCE_MS)
})

watch(statusFilter, (value) => pushQuery({ status: value || undefined }))

// 'mine' is the default, so it stays out of the URL.
watch(scope, (value) => pushQuery({ scope: value === 'all' ? 'all' : undefined }))

watch(sortValue, (value) => {
  const [sort, direction] = value.split(':')
  pushQuery({ sort, direction })
})

// Keep the controls in step with the URL when the user hits back/forward.
watch(
  () => route.query,
  () => {
    if (queryString('search') !== searchInput.value.trim()) searchInput.value = queryString('search')
    statusFilter.value = queryString('status')
    sortValue.value = currentSort()
    scope.value = currentScope()

    store.fetchTasks(apiQuery())
  },
  { immediate: true },
)

function goToPage(page: number) {
  pushQuery({ page }, false)
}

function reload() {
  store.fetchTasks(apiQuery())
}

/**
 * Re-sync the page after a create/update/delete. The change is already applied
 * locally, so this swaps the rows underneath the user instead of emptying the
 * list and flashing the loading spinner.
 */
function refreshQuietly() {
  return store.fetchTasks(apiQuery(), { silent: true })
}

// --- Flash the freshly created task ----------------------------------------
// An edit updates a row that is already on screen and the toast is enough, but
// a brand new task needs pointing at — it can land anywhere in the sort order.
const createdId = ref<number | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | undefined

function flashCreated(id: number) {
  clearTimeout(highlightTimer)
  createdId.value = id

  highlightTimer = setTimeout(() => {
    if (createdId.value === id) createdId.value = null
  }, HIGHLIGHT_MS)
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  clearTimeout(highlightTimer)
})

// --- Create / edit ---------------------------------------------------------
const showModal = ref(false)
const editing = ref<Task | null>(null)

function openCreate() {
  editing.value = null
  showModal.value = true
}

function openEdit(task: Task) {
  editing.value = task
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editing.value = null
}

async function onSaved(task: Task) {
  const wasEdit = !!editing.value
  closeModal()

  toasts.success(wasEdit ? 'Задача обновлена.' : 'Задача создана.')

  await refreshQuietly()

  // Only flash a new task, and only if it actually landed on the page we are
  // looking at — an active filter or sort can push it onto another page.
  if (!wasEdit && store.items.some((item) => item.id === task.id)) {
    flashCreated(task.id)
  }
}

// --- Delete ----------------------------------------------------------------
const deleting = ref<Task | null>(null)
const deleteBusy = ref(false)
const deleteError = ref<string | null>(null)

function askDelete(task: Task) {
  deleting.value = task
  deleteError.value = null
}

async function confirmDelete() {
  if (!deleting.value) return

  deleteBusy.value = true
  deleteError.value = null

  try {
    // The row is removed from the list as soon as the request succeeds.
    const message = await store.deleteTask(deleting.value.id)
    deleting.value = null
    toasts.success(message)

    // Deleting the last row of a page would leave us on an empty page.
    const meta = store.meta
    if (store.items.length === 0 && meta && meta.current_page > 1) {
      goToPage(meta.current_page - 1)
    } else {
      await refreshQuietly()
    }
  } catch (e) {
    deleteError.value = apiErrorMessage(e, 'Не удалось удалить задачу.')
  } finally {
    deleteBusy.value = false
  }
}
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.page-title {
  margin: 0;
}
.page-sub {
  margin: 0.15rem 0 0;
  font-size: 0.9rem;
}
.scope-switch {
  display: inline-flex;
  padding: 0.25rem;
  gap: 0.25rem;
  margin-bottom: 1rem;
  background: #eef0f4;
  border-radius: 999px;
}
.scope-btn {
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 0.4rem 1rem;
  font-size: 0.88rem;
  font-weight: 600;
}
.scope-btn:hover:not(.active) {
  color: var(--text);
}
.scope-btn.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.toolbar {
  display: flex;
  gap: 0.75rem;
  padding: 0.85rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}
.toolbar-search {
  flex: 2 1 200px;
}
.toolbar select {
  flex: 1 1 140px;
  width: auto;
}
.task-list-wrap {
  position: relative;
}
.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: opacity 0.15s ease;
}
.task-list.refreshing {
  opacity: 0.55;
  pointer-events: none;
}
.refresh-badge {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  font-size: 0.82rem;
  color: var(--muted);
  z-index: 10;
}
.state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  padding: 2rem 0;
  justify-content: center;
}
.state-block {
  margin: 1rem 0;
}
.retry {
  margin-left: 0.75rem;
}
.empty {
  flex-direction: column;
  text-align: center;
  padding: 3rem 1rem;
}
.empty-title {
  margin: 0 0 0.4rem;
  font-weight: 600;
  color: var(--text);
}
.empty-sub {
  margin: 0;
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(16, 24, 40, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 60;
}
.confirm {
  width: 100%;
  max-width: 380px;
  padding: 1.5rem;
}
.confirm-title {
  margin-top: 0;
}
.confirm-alert {
  margin-top: 1rem;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.25rem;
}
</style>
