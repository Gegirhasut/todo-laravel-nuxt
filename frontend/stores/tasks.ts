import { defineStore } from 'pinia'
import type { Paginated, PaginationMeta, Task, TaskPayload, TaskQuery } from '~/types'

export const useTasksStore = defineStore('tasks', () => {
  const items = ref<Task[]>([])
  const meta = ref<PaginationMeta | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isEmpty = computed(() => !loading.value && !error.value && items.value.length === 0)

  interface FetchOptions {
    /**
     * Refresh the rows underneath the user without emptying the list first.
     * Used after a create/update/delete, where blanking the list and flashing
     * a spinner would look like a full page reload.
     */
    silent?: boolean
  }

  async function fetchTasks(query: TaskQuery = {}, { silent = false }: FetchOptions = {}): Promise<void> {
    if (!silent) loading.value = true
    error.value = null

    try {
      const res = await useApi()<Paginated<Task>>('/tasks', {
        // Undefined entries are dropped from the query string by ofetch.
        query: {
          search: query.search || undefined,
          status: query.status || undefined,
          sort: query.sort || undefined,
          direction: query.direction || undefined,
          page: query.page || undefined,
          per_page: query.per_page || undefined,
        },
      })

      items.value = res.data
      meta.value = res.meta
    } catch (e) {
      // A silent refresh runs after a write that already succeeded and was
      // applied locally, so a failed re-sync must not wipe the list or throw
      // the user into the error state.
      if (!silent) {
        error.value = apiErrorMessage(e, 'Failed to load tasks.')
        items.value = []
        meta.value = null
      }
    } finally {
      loading.value = false
    }
  }

  async function createTask(payload: TaskPayload): Promise<Task> {
    const res = await useApi()<{ data: Task }>('/tasks', {
      method: 'POST',
      body: payload,
    })

    return res.data
  }

  async function updateTask(id: number, payload: Partial<TaskPayload>): Promise<Task> {
    const res = await useApi()<{ data: Task }>(`/tasks/${id}`, {
      method: 'PATCH',
      body: payload,
    })

    // Reflect the change in the list straight away, before any refetch.
    const index = items.value.findIndex((task) => task.id === id)
    if (index !== -1) items.value[index] = res.data

    return res.data
  }

  async function deleteTask(id: number): Promise<void> {
    await useApi()(`/tasks/${id}`, { method: 'DELETE' })
    items.value = items.value.filter((task) => task.id !== id)
  }

  return {
    items,
    meta,
    loading,
    error,
    isEmpty,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  }
})
