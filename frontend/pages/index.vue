<template>
  <div>
    <!-- The list hides only under a directly-loaded task page; under the
         overlay it stays mounted and untouched. -->
    <div v-if="showList" class="container">
      <div class="page-head">
        <div>
          <h1 class="page-title">Задачи</h1>
          <p class="muted page-sub">{{ subtitle }}</p>
        </div>
        <!-- Full label on wide screens, a compact accent «+» on phones. -->
        <button
          class="btn-primary new-task-btn"
          aria-label="Новая задача"
          title="Новая задача"
          @click="openCreate"
        >
          <svg class="new-task-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M10 4v12M4 10h12" />
          </svg>
          <span class="new-task-label">Новая задача</span>
        </button>
      </div>

      <!-- Two clusters: the FILTERS (with their reset right beside them) and
           the VIEW option (sort), visually apart — the reset clears only the
           group it sits in. role="search" is the landmark; the native
           <search> element trips Vue's component resolution. -->
      <div role="search" class="toolbar card">
        <div class="toolbar-group filter-group">
          <div class="toolbar-field toolbar-search">
            <label for="task-search" class="sr-only">Поиск задач</label>
            <input id="task-search" v-model="searchInput" type="search" placeholder="Поиск задач…">
          </div>

          <div class="toolbar-field">
            <label for="status-filter" class="sr-only">Фильтр по статусу</label>
            <select id="status-filter" v-model="statusFilter">
              <option value="">Все статусы</option>
              <option v-for="option in TASK_STATUSES" :key="option" :value="option">
                {{ statusLabel(option) }}
              </option>
            </select>
          </div>

          <!-- Always in its slot so the row never shifts; disabled until a
               filter is applied. Sorting is a view option, not a filter —
               it neither enables the button nor gets reset by it. -->
          <button
            type="button"
            class="toolbar-reset"
            :disabled="!hasActiveFilters"
            aria-label="Сбросить фильтры"
            title="Сбросить фильтры"
            @click="resetFilters"
          >
            <!-- A funnel with an × — clears the filters, not a reload. -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055" />
              <path d="m22 3-5 5" />
              <path d="m17 3 5 5" />
            </svg>
          </button>
        </div>

        <div class="toolbar-group view-group">
          <div class="toolbar-field">
            <label for="sort-order" class="sr-only">Сортировка</label>
            <select id="sort-order" v-model="sortValue">
              <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="store.loading" class="state" role="status">
        <span class="spinner spinner-dark" aria-hidden="true" /> Загрузка задач…
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
        <ul class="task-list" :class="{ refreshing: store.refreshing }" :aria-busy="store.refreshing">
          <li v-for="task in store.items" :key="task.id">
            <TaskRow
              :task="task"
              :show-owner="listHasSeveralOwners"
              @open="taskOverlay = true"
            />
          </li>
        </ul>

        <p v-if="store.refreshing" class="refresh-badge" role="status">
          <span class="spinner spinner-dark" aria-hidden="true" /> Обновление…
        </p>
      </div>

      <AppPagination v-if="!store.loading && !store.error" :meta="store.meta" @change="goToPage" />
    </div>

    <!-- /tasks/{id} and /tasks/new render here, stacked over the list or as a full page. -->
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import type { SortColumn, SortDirection, TaskQuery, TaskStatus } from '~/types'

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

const auth = useAuthStore()
const store = useTasksStore()
const route = useRoute()
const router = useRouter()

// True while the task detail child route was opened from within the list, so
// it stacks as an overlay and the list stays mounted underneath. A directly
// loaded /tasks/{id} leaves it false and hides the list entirely.
const taskOverlay = useState('task-detail-overlay', () => false)
const showList = computed(() => route.path === '/' || taskOverlay.value)

// Set by the detail view after a create or delete, so the list re-syncs the
// next time it is in front — without refetching on every overlay close.
const listStale = useState('tasks-list-stale', () => false)

function queryString(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

// The URL is the single source of truth for the list controls, so a page can
// be shared, bookmarked and survive a refresh.
const searchInput = ref(queryString('search'))
const statusFilter = ref(queryString('status'))
const sortValue = ref(currentSort())

const hasActiveFilters = computed(() => !!queryString('search') || !!queryString('status'))

// Only an admin's list mixes several owners; a user only ever sees their own.
const listHasSeveralOwners = computed(() => auth.isAdmin)

const emptyHint = computed(() => {
  if (hasActiveFilters.value) return 'Попробуйте изменить поиск или сбросить фильтр.'
  if (listHasSeveralOwners.value) return 'Пока никто не создал ни одной задачи.'
  return 'Создайте первую задачу, чтобы начать.'
})

const subtitle = computed(() =>
  auth.isAdmin ? 'Показаны задачи всех пользователей.' : 'Ваши задачи.',
)

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
    sort,
    direction,
    page: Number(queryString('page')) || undefined,
  }
}

interface QueryOptions {
  /** Any change to search/filter/sort invalidates the current page number. */
  resetPage?: boolean
  /**
   * Overwrite the current history entry instead of adding one. Used for
   * debounced search keystrokes, where every letter as a Back-button stop
   * would be noise; deliberate actions (filter, sort, page) get real entries.
   */
  replace?: boolean
}

/** Merge a patch into the URL query; empty values drop the key entirely. */
function pushQuery(
  patch: Record<string, string | number | undefined>,
  { resetPage = true, replace = false }: QueryOptions = {},
) {
  const next: Record<string, string> = { ...(route.query as Record<string, string>) }

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') delete next[key]
    else next[key] = String(value)
  }

  if (resetPage) delete next.page

  if (replace) router.replace({ query: next })
  else router.push({ query: next })
}

// Debounce the search box so we don't hit the API on every keystroke.
let searchTimer: ReturnType<typeof setTimeout> | undefined

// While a reset runs, the control watchers stay quiet: they would each push
// a query computed from the route as it was BEFORE the reset navigation
// resolves, re-applying the very filters being cleared.
let resettingFilters = false

watch(searchInput, (value) => {
  if (resettingFilters) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(
    () => pushQuery({ search: value.trim() || undefined }, { replace: true }),
    SEARCH_DEBOUNCE_MS,
  )
})

watch(statusFilter, (value) => {
  if (resettingFilters) return
  pushQuery({ status: value || undefined })
})

watch(sortValue, (value) => {
  // The default sort is not state worth writing to the URL — only a
  // deliberately chosen one stays shareable in the address.
  if (value === DEFAULT_SORT) {
    pushQuery({ sort: undefined, direction: undefined })
    return
  }

  const [sort, direction] = value.split(':')
  pushQuery({ sort, direction })
})

// Keep the controls in step with the URL when the user hits back/forward.
// The key guard means stacking the detail route on top (and coming back from
// it) never refetches or resets the list the user was just looking at —
// unless the detail view marked the list stale (create/delete).
let lastFetchedKey: string | null = null

watch(
  () => route.query,
  () => {
    // A /tasks/{id} child is on top; the list is either hidden or untouched.
    if (route.path !== '/') return

    if (queryString('search') !== searchInput.value.trim()) searchInput.value = queryString('search')
    statusFilter.value = queryString('status')
    sortValue.value = currentSort()

    const key = JSON.stringify(route.query)
    if (key === lastFetchedKey && !listStale.value) return

    // A stale re-sync swaps the rows in place instead of blanking the list.
    const silent = listStale.value && key === lastFetchedKey && store.items.length > 0
    lastFetchedKey = key
    listStale.value = false

    store.fetchTasks(apiQuery(), { silent })
  },
  { immediate: true },
)

function goToPage(page: number) {
  pushQuery({ page }, { resetPage: false })
}

/** Clears search + status (and the page) in one go; the sort stays. */
function resetFilters() {
  // A pending debounced keystroke must not re-apply the old search term.
  clearTimeout(searchTimer)
  resettingFilters = true
  searchInput.value = ''
  statusFilter.value = ''
  pushQuery({ search: undefined, status: undefined })
  nextTick(() => {
    resettingFilters = false
  })
}

function reload() {
  store.fetchTasks(apiQuery())
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
})

/** Creating happens in the same detail card, opened empty over the list. */
function openCreate() {
  taskOverlay.value = true
  router.push('/tasks/new')
}
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.page-title {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.3;
}
.page-sub {
  margin: var(--space-1) 0 0;
  font-size: 0.9rem;
}
.new-task-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
  flex-shrink: 0;
}
.new-task-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
/* Phones: just the accent «+», sized like the other header controls. */
@media (max-width: 640px) {
  .new-task-btn {
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    justify-content: center;
    border-radius: var(--radius-sm);
  }
  .new-task-label {
    display: none;
  }
  .new-task-icon {
    width: 18px;
    height: 18px;
  }
}
/* Desktop: one row of two clusters — filters (search, status, their reset)
   on the left, the sort on the right behind a divider. Widths keep the
   longest select label visible; nothing ever clips. */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  margin-bottom: var(--space-5);
}
.toolbar-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.filter-group {
  flex: 1 1 34rem;
}
.filter-group .toolbar-field:not(.toolbar-search) {
  flex: 0 0 13rem;
}
.view-group {
  flex: 0 0 auto;
  margin-left: auto;
  padding-left: var(--space-5);
  border-left: 1px solid var(--border);
}
.view-group .toolbar-field {
  flex: 0 0 13rem;
}
.toolbar-field {
  min-width: 0;
}
.toolbar-search {
  flex: 1 1 12rem;
  /* Don't stretch the filter cluster all the way to the sort — the empty
     space between the groups is part of the message. */
  max-width: 26rem;
}
.toolbar-reset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--primary-strong);
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}
.toolbar-reset:hover:not(:disabled) {
  background: var(--surface-hover);
}
.toolbar-reset:disabled {
  color: var(--muted);
  opacity: 0.45;
  cursor: default;
}
.toolbar-reset svg {
  width: 18px;
  height: 18px;
}
/* Narrow: the filter cluster wraps (search full row, then status + reset),
   the sort drops to its own full row — still a separate group, minus the
   divider that only makes sense side by side. */
@media (max-width: 860px) {
  .filter-group {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }
  .toolbar-search {
    flex: 1 1 100%;
  }
  .filter-group .toolbar-field:not(.toolbar-search) {
    flex: 1 1 auto;
  }
  .view-group {
    flex: 1 1 100%;
    margin-left: 0;
    padding-left: 0;
    border-left: none;
  }
  .view-group .toolbar-field {
    flex: 1 1 auto;
  }
}
.task-list-wrap {
  position: relative;
}
.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: opacity 0.15s ease;
  list-style: none;
  margin: 0;
  padding: 0;
}
.task-list.refreshing {
  opacity: 0.55;
  pointer-events: none;
}
.refresh-badge {
  position: absolute;
  top: var(--space-2);
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
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
  gap: var(--space-2);
  color: var(--muted);
  padding: var(--space-6) 0;
  justify-content: center;
}
.state-block {
  margin: var(--space-4) 0;
}
.retry {
  margin-left: var(--space-3);
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
</style>
