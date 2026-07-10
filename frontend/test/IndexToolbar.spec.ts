import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IndexPage from '~/pages/index.vue'

const tasksStore = vi.hoisted(() => ({
  items: [] as unknown[],
  meta: null,
  loading: false,
  refreshing: false,
  error: null,
  isEmpty: false,
  fetchTasks: vi.fn(),
}))

mockNuxtImport('useTasksStore', () => () => tasksStore)
mockNuxtImport('useAuthStore', () => () => ({
  user: { id: 7, name: 'Regular User', email: 'user@example.com', role: 'user' },
  isAdmin: false,
  // The auth middleware also guards the test router.
  isAuthenticated: true,
}))

/** Apply filters through the URL — the page treats it as the source of truth. */
async function applyFilters(query: Record<string, string>) {
  await useRouter().push({ path: '/', query })
  await flushPromises()
}

/** The URL settles asynchronously (debounce + router); poll until it does. */
async function settled(check: () => boolean, timeout = 2000) {
  const started = Date.now()
  while (!check() && Date.now() - started < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    await flushPromises()
  }
}

describe('task list toolbar — Сбросить', () => {
  // One live page instance at a time: a leftover instance's URL-sync watchers
  // would react to the next test's navigation too.
  let wrapper: { unmount: () => void } | null = null

  async function mountPage() {
    const mounted = await mountSuspended(IndexPage, { route: '/' })
    wrapper = mounted
    return mounted
  }

  beforeEach(async () => {
    tasksStore.fetchTasks.mockReset()
    await useRouter().push('/')
    await flushPromises()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  const resetButton = (wrapper: { find: (s: string) => any }) =>
    wrapper.find('.toolbar-reset').element as HTMLButtonElement

  it('sits disabled without filters, enables with them, and clears everything', async () => {
    const wrapper = await mountPage()

    // Always rendered — but inert until a filter is applied.
    expect(wrapper.find('.toolbar-reset').exists()).toBe(true)
    expect(wrapper.find('.toolbar-reset').attributes('aria-label')).toBe('Сбросить фильтры')
    expect(resetButton(wrapper).disabled).toBe(true)

    await applyFilters({ search: 'молоко', status: 'pending', page: '2' })
    await settled(() => !resetButton(wrapper).disabled)

    // The URL hydrated the controls.
    expect(wrapper.find<HTMLInputElement>('#task-search').element.value).toBe('молоко')

    await wrapper.find('.toolbar-reset').trigger('click')
    // A stale debounced keystroke must not re-apply the old term.
    await settled(() => useRouter().currentRoute.value.fullPath === '/')

    // Controls emptied, URL params gone, unfiltered list refetched.
    expect(wrapper.find<HTMLInputElement>('#task-search').element.value).toBe('')
    expect(wrapper.find<HTMLSelectElement>('#status-filter').element.value).toBe('')
    const query = useRouter().currentRoute.value.query
    expect(query.search).toBeUndefined()
    expect(query.status).toBeUndefined()
    expect(query.page).toBeUndefined()
    expect(tasksStore.fetchTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: undefined, status: undefined, page: undefined }),
      expect.anything(),
    )
    // Still in its slot, back to disabled.
    expect(wrapper.find('.toolbar-reset').exists()).toBe(true)
    expect(resetButton(wrapper).disabled).toBe(true)
  })

  it('leaves the sort untouched, and the sort alone does not enable it', async () => {
    const wrapper = await mountPage()

    await applyFilters({ sort: 'title', direction: 'asc' })
    await settled(() => useRouter().currentRoute.value.query.sort === 'title')
    // Sort is not a filter: clicking reset would change nothing, so it stays off.
    expect(resetButton(wrapper).disabled).toBe(true)

    await applyFilters({ status: 'completed', sort: 'title', direction: 'asc' })
    await settled(() => !resetButton(wrapper).disabled)

    await wrapper.find('.toolbar-reset').trigger('click')
    await settled(() => useRouter().currentRoute.value.query.status === undefined)

    expect(wrapper.find<HTMLSelectElement>('#sort-order').element.value).toBe('title:asc')
    const query = useRouter().currentRoute.value.query
    expect(query.sort).toBe('title')
    expect(query.direction).toBe('asc')
    expect(query.status).toBeUndefined()
  })
})
