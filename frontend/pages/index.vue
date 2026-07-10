<template>
  <div class="container">
    <div class="page-head">
      <div>
        <h1 class="page-title">Tasks</h1>
        <p class="muted page-sub">
          {{ auth.isAdmin ? 'Showing tasks from all users.' : 'Your tasks.' }}
        </p>
      </div>
      <button class="btn-primary" @click="openCreate">+ New task</button>
    </div>

    <div class="toolbar card">
      <input
        v-model="searchInput"
        type="search"
        class="toolbar-search"
        placeholder="Search tasks…"
        aria-label="Search tasks"
      >

      <select v-model="statusFilter" aria-label="Filter by status">
        <option value="">All statuses</option>
        <option v-for="option in TASK_STATUSES" :key="option" :value="option">
          {{ statusLabel(option) }}
        </option>
      </select>

      <select v-model="sortValue" aria-label="Sort by">
        <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div v-if="store.loading" class="state">
      <span class="spinner spinner-dark" /> Loading tasks…
    </div>

    <div v-else-if="store.error" class="alert-error state-block" role="alert">
      {{ store.error }}
      <button class="btn-ghost btn-sm retry" @click="reload">Retry</button>
    </div>

    <div v-else-if="store.isEmpty" class="state empty card">
      <p class="empty-title">No tasks found</p>
      <p class="muted empty-sub">
        {{
          hasActiveFilters
            ? 'Try clearing the search or the status filter.'
            : 'Create your first task to get started.'
        }}
      </p>
    </div>

    <div v-else class="task-list">
      <TaskRow
        v-for="task in store.items"
        :key="task.id"
        :task="task"
        @edit="openEdit"
        @delete="askDelete"
      />
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
        <h3 class="confirm-title">Delete task?</h3>
        <p class="muted">“{{ deleting.title }}” will be permanently removed.</p>

        <div v-if="deleteError" class="alert-error confirm-alert" role="alert">
          {{ deleteError }}
        </div>

        <div class="confirm-actions">
          <button class="btn-ghost" :disabled="deleteBusy" @click="deleting = null">Cancel</button>
          <button class="btn-danger" :disabled="deleteBusy" @click="confirmDelete">
            <span v-if="deleteBusy" class="spinner spinner-dark" />
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SortColumn, SortDirection, Task, TaskQuery, TaskStatus } from '~/types'

definePageMeta({ middleware: 'auth' })

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'due_date:asc', label: 'Due date ↑' },
  { value: 'due_date:desc', label: 'Due date ↓' },
  { value: 'status:asc', label: 'Status' },
  { value: 'title:asc', label: 'Title A–Z' },
] as const

const DEFAULT_SORT = 'created_at:desc'
const SEARCH_DEBOUNCE_MS = 350

const auth = useAuthStore()
const store = useTasksStore()
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

const hasActiveFilters = computed(() => !!queryString('search') || !!queryString('status'))

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

onBeforeUnmount(() => clearTimeout(searchTimer))

watch(statusFilter, (value) => pushQuery({ status: value || undefined }))

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

function onSaved() {
  closeModal()
  refreshQuietly()
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
    await store.deleteTask(deleting.value.id)
    deleting.value = null

    // Deleting the last row of a page would leave us on an empty page.
    const meta = store.meta
    if (store.items.length === 0 && meta && meta.current_page > 1) {
      goToPage(meta.current_page - 1)
    } else {
      await refreshQuietly()
    }
  } catch (e) {
    deleteError.value = apiErrorMessage(e, 'Could not delete the task.')
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
.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
