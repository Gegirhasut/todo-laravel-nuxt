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
        scope: undefined,
        sort: undefined,
        direction: undefined,
        page: 2,
        per_page: undefined,
      },
    })
  })

  it('passes scope=all through to the API', async () => {
    apiMock.mockResolvedValue({ data: [task()], meta })

    const store = useTasksStore()
    await store.fetchTasks({ scope: 'all' })

    expect(apiMock).toHaveBeenCalledWith('/tasks', {
      query: expect.objectContaining({ scope: 'all' }),
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
    apiMock.mockRejectedValue(Object.assign(new Error('boom'), { data: { message: 'Ошибка сервера.' } }))

    const store = useTasksStore()
    store.items = [task()]
    await store.fetchTasks()

    expect(store.error).toBe('Ошибка сервера.')
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
    // An error is not an empty list — the UI shows a retry, not "no tasks".
    expect(store.isEmpty).toBe(false)
  })

  it('a silent refresh reports "refreshing", never "loading", so the list is not torn down', async () => {
    const store = useTasksStore()
    store.items = [task()]

    let seen: { loading: boolean; refreshing: boolean } | undefined
    apiMock.mockImplementation(async () => {
      seen = { loading: store.loading, refreshing: store.refreshing }
      return { data: [task({ status: 'completed' })], meta }
    })

    await store.fetchTasks({}, { silent: true })

    expect(seen).toEqual({ loading: false, refreshing: true })
    expect(store.refreshing).toBe(false)
    expect(store.items[0]!.status).toBe('completed')
  })

  it('a normal fetch reports "loading", not "refreshing"', async () => {
    const store = useTasksStore()

    let seen: { loading: boolean; refreshing: boolean } | undefined
    apiMock.mockImplementation(async () => {
      seen = { loading: store.loading, refreshing: store.refreshing }
      return { data: [task()], meta }
    })

    await store.fetchTasks()

    expect(seen).toEqual({ loading: true, refreshing: false })
    expect(store.loading).toBe(false)
  })

  it('clears the refreshing flag even when the silent refresh fails', async () => {
    apiMock.mockRejectedValue(new Error('boom'))

    const store = useTasksStore()
    store.items = [task()]

    await store.fetchTasks({}, { silent: true })

    expect(store.refreshing).toBe(false)
    expect(store.items).toHaveLength(1)
  })

  it('a failed silent refresh keeps the rows that are already on screen', async () => {
    apiMock.mockRejectedValue(Object.assign(new Error('boom'), { data: { message: 'Ошибка сервера.' } }))

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
    apiMock.mockResolvedValue({ message: 'Задача удалена.' })

    const store = useTasksStore()
    store.items = [task({ id: 1 }), task({ id: 2 })]

    const message = await store.deleteTask(1)

    expect(apiMock).toHaveBeenCalledWith('/tasks/1', { method: 'DELETE' })
    expect(store.items.map((t) => t.id)).toEqual([2])
    // The confirmation the API sent back is what the toast shows.
    expect(message).toBe('Задача удалена.')
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
