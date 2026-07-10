import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTasksStore } from '~/stores/tasks'
import type { Task } from '~/types'

const apiMock = vi.fn()

mockNuxtImport('useApi', () => () => apiMock)

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    user_id: 1,
    title: 'Buy milk',
    description: null,
    due_date: null,
    status: 'pending',
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
    ...overrides,
  }
}

const meta = { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 }

describe('tasks store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
  })

  it('loads a page of tasks and drops the empty query parameters', async () => {
    apiMock.mockResolvedValue({ data: [task()], meta })

    const store = useTasksStore()
    await store.fetchTasks({ search: 'milk', status: undefined, page: 2 })

    expect(store.items).toHaveLength(1)
    expect(store.meta?.total).toBe(1)
    expect(store.loading).toBe(false)
    expect(store.isEmpty).toBe(false)

    expect(apiMock).toHaveBeenCalledWith('/tasks', {
      query: {
        search: 'milk',
        status: undefined,
        sort: undefined,
        direction: undefined,
        page: 2,
        per_page: undefined,
      },
    })
  })

  it('reports an empty list when the API returns no rows', async () => {
    apiMock.mockResolvedValue({ data: [], meta: { ...meta, total: 0 } })

    const store = useTasksStore()
    await store.fetchTasks()

    expect(store.isEmpty).toBe(true)
    expect(store.error).toBeNull()
  })

  it('captures the API error message and clears the list', async () => {
    apiMock.mockRejectedValue(Object.assign(new Error('boom'), { data: { message: 'Server error.' } }))

    const store = useTasksStore()
    store.items = [task()]
    await store.fetchTasks()

    expect(store.error).toBe('Server error.')
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
    // An error is not an empty list — the UI shows a retry, not "no tasks".
    expect(store.isEmpty).toBe(false)
  })

  it('a silent refresh never blanks the list, so the UI does not flash a spinner', async () => {
    const store = useTasksStore()
    store.items = [task()]

    let loadingWhileFetching: boolean | undefined
    apiMock.mockImplementation(async () => {
      loadingWhileFetching = store.loading
      return { data: [task({ status: 'completed' })], meta }
    })

    await store.fetchTasks({}, { silent: true })

    expect(loadingWhileFetching).toBe(false)
    expect(store.items[0]!.status).toBe('completed')
  })

  it('a normal fetch does show the loading state', async () => {
    const store = useTasksStore()

    let loadingWhileFetching: boolean | undefined
    apiMock.mockImplementation(async () => {
      loadingWhileFetching = store.loading
      return { data: [task()], meta }
    })

    await store.fetchTasks()

    expect(loadingWhileFetching).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('a failed silent refresh keeps the rows that are already on screen', async () => {
    apiMock.mockRejectedValue(Object.assign(new Error('boom'), { data: { message: 'Server error.' } }))

    const store = useTasksStore()
    store.items = [task()]

    await store.fetchTasks({}, { silent: true })

    // The write it followed already succeeded, so nothing should be torn down.
    expect(store.items).toHaveLength(1)
    expect(store.error).toBeNull()
  })

  it('replaces the updated task in place', async () => {
    const updated = task({ status: 'completed' })
    apiMock.mockResolvedValue({ data: updated })

    const store = useTasksStore()
    store.items = [task({ id: 2 }), task({ id: 1 })]

    await store.updateTask(1, { status: 'completed' })

    expect(apiMock).toHaveBeenCalledWith('/tasks/1', { method: 'PATCH', body: { status: 'completed' } })
    expect(store.items[1]!.status).toBe('completed')
    expect(store.items[0]!.status).toBe('pending')
  })

  it('removes a deleted task from the list', async () => {
    apiMock.mockResolvedValue({ message: 'Task deleted.' })

    const store = useTasksStore()
    store.items = [task({ id: 1 }), task({ id: 2 })]

    await store.deleteTask(1)

    expect(apiMock).toHaveBeenCalledWith('/tasks/1', { method: 'DELETE' })
    expect(store.items.map((t) => t.id)).toEqual([2])
  })

  it('lets a failed create bubble up so the form can show the 422', async () => {
    const error = Object.assign(new Error('422'), {
      data: { message: 'The title field is required.', errors: { title: ['The title field is required.'] } },
    })
    apiMock.mockRejectedValue(error)

    const store = useTasksStore()

    await expect(
      store.createTask({ title: '', description: null, due_date: null, status: 'pending' }),
    ).rejects.toThrow()
  })
})
