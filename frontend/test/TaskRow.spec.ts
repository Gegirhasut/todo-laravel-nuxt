import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskRow from '~/components/TaskRow.vue'
import type { Role, Task, User } from '~/types'

// The component only reads the current user off the auth store, so a plain
// stand-in keeps these tests about the display rules and nothing else.
const auth = vi.hoisted(() => ({
  user: null as User | null,
  isAdmin: false,
}))

mockNuxtImport('useAuthStore', () => () => auth)

const OWNER_ID = 7
const STRANGER_ID = 99

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    user_id: OWNER_ID,
    title: 'Buy milk',
    description: null,
    due_date: null,
    status: 'pending',
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
    owner: { id: OWNER_ID, name: 'Regular User' },
    ...overrides,
  }
}

function signIn(id: number, role: Role = 'user') {
  auth.user = { id, name: 'Someone', email: 'someone@example.com', role }
  auth.isAdmin = role === 'admin'
}

describe('TaskRow', () => {
  beforeEach(() => {
    auth.user = null
    auth.isAdmin = false
    signIn(OWNER_ID)
  })

  it('is read-only: the row renders no action buttons at all', async () => {
    const wrapper = await mountSuspended(TaskRow, { props: { task: task() } })

    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('links the title to the task detail page and reports the click', async () => {
    const wrapper = await mountSuspended(TaskRow, { props: { task: task({ id: 42 }) } })
    const link = wrapper.find('.task-link')

    expect(link.attributes('href')).toBe('/tasks/42')
    expect(link.text()).toBe('Buy milk')

    // Clicking also tells the list to stack the detail as an overlay.
    await link.trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('shows the deadline with an accessible label', async () => {
    const wrapper = await mountSuspended(TaskRow, {
      props: { task: task({ due_date: '2026-08-01' }) },
    })

    expect(wrapper.find('.due').text()).toContain('2026')
    expect(wrapper.find('.due .sr-only').text()).toBe('Срок:')
  })

  it('renders a subtle «Без срока» when there is no deadline', async () => {
    const wrapper = await mountSuspended(TaskRow, { props: { task: task({ due_date: null }) } })

    expect(wrapper.find('.no-due').text()).toBe('Без срока')
    expect(wrapper.find('.due').exists()).toBe(false)
  })

  it('marks an open task with a past deadline as overdue', async () => {
    const wrapper = await mountSuspended(TaskRow, {
      props: { task: task({ due_date: '2000-01-01', status: 'pending' }) },
    })

    expect(wrapper.find('.overdue').exists()).toBe(true)
  })

  it('does not mark a completed task as overdue', async () => {
    const wrapper = await mountSuspended(TaskRow, {
      props: { task: task({ due_date: '2000-01-01', status: 'completed' }) },
    })

    expect(wrapper.find('.overdue').exists()).toBe(false)
  })

  it('strikes through the title of a completed task', async () => {
    const wrapper = await mountSuspended(TaskRow, {
      props: { task: task({ status: 'completed' }) },
    })

    expect(wrapper.find('.task-title').classes()).toContain('done')
  })

  it('marks the viewer own task with «Моя» in a mixed-owner list', async () => {
    const wrapper = await mountSuspended(TaskRow, { props: { task: task(), showOwner: true } })

    expect(wrapper.find('.badge-own').text()).toBe('Моя')
    // The badge says it already — no need to repeat the owner's name.
    expect(wrapper.text()).not.toContain('Regular User')
  })

  it('shows the owner name on a foreign task in a mixed-owner list', async () => {
    signIn(STRANGER_ID, 'admin')
    const wrapper = await mountSuspended(TaskRow, { props: { task: task(), showOwner: true } })

    expect(wrapper.find('.badge-own').exists()).toBe(false)
    expect(wrapper.text()).toContain('Regular User')
  })

  it('hides the owner name in a single-owner list', async () => {
    const wrapper = await mountSuspended(TaskRow, { props: { task: task() } })

    expect(wrapper.text()).not.toContain('Regular User')
  })
})
