import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

/**
 * These tests pin how the toolbar renders from the URL it was opened with.
 * The URL-mutation side (clicking reset rewrites the query, the debounce,
 * sort survival) lives in the browser-level checks — the test router here
 * does not faithfully reproduce in-app navigation.
 */
describe('task list toolbar — Сбросить', () => {
  let wrapper: { unmount: () => void } | null = null

  async function mountAt(route: string) {
    const mounted = await mountSuspended(IndexPage, { route })
    wrapper = mounted
    await flushPromises()
    return mounted
  }

  beforeEach(async () => {
    tasksStore.fetchTasks.mockReset()
    wrapper?.unmount()
    wrapper = null
    await useRouter().push('/')
    await flushPromises()
  })

  it('sits in its slot disabled while no filter is applied', async () => {
    const page = await mountAt('/')

    const reset = page.find('.toolbar-reset')
    expect(reset.exists()).toBe(true)
    expect(reset.attributes('aria-label')).toBe('Сбросить фильтры')
    expect((reset.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables once the URL carries a search or a status filter', async () => {
    const withSearch = await mountAt('/?search=молоко')
    expect((withSearch.find('.toolbar-reset').element as HTMLButtonElement).disabled).toBe(false)
    // The URL hydrated the control too.
    expect(withSearch.find<HTMLInputElement>('#task-search').element.value).toBe('молоко')
    withSearch.unmount()
    wrapper = null

    const withStatus = await mountAt('/?status=pending')
    expect((withStatus.find('.toolbar-reset').element as HTMLButtonElement).disabled).toBe(false)
    expect(withStatus.find<HTMLSelectElement>('#status-filter').element.value).toBe('pending')
  })

  it('stays disabled for a sort-only URL — sorting is not a filter', async () => {
    const page = await mountAt('/?sort=title&direction=asc')

    expect((page.find('.toolbar-reset').element as HTMLButtonElement).disabled).toBe(true)
    expect(page.find<HTMLSelectElement>('#sort-order').element.value).toBe('title:asc')
  })
})
