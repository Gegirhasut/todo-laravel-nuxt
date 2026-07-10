import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskRow from '~/components/TaskRow.vue'
import type { Role, Task, User } from '~/types'

// The component only reads the current user off the auth store, so a plain
// stand-in keeps these tests about the permission rules and nothing else.
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
    owner: { id: OWNER_ID, name: 'Regular User', email: 'user@example.com' },
    ...overrides,
  }
}

function signIn(id: number, role: Role = 'user') {
  auth.user = { id, name: 'Someone', email: 'someone@example.com', role }
  auth.isAdmin = role === 'admin'
}

async function buttonsFor(taskProp: Task) {
  const wrapper = await mountSuspended(TaskRow, { props: { task: taskProp } })
  return wrapper.findAll('button').map((button) => button.text())
}

describe('TaskRow permissions', () => {
  beforeEach(() => {
    auth.user = null
    auth.isAdmin = false
  })

  it('shows Edit and Delete to the owner of the task', async () => {
    signIn(OWNER_ID)
    expect(await buttonsFor(task())).toEqual(['Edit', 'Delete'])
  })

  it('hides Edit and Delete from a user who does not own the task', async () => {
    signIn(STRANGER_ID)
    expect(await buttonsFor(task())).toEqual([])
  })

  it('shows Edit and Delete to an admin, even on a task they do not own', async () => {
    signIn(STRANGER_ID, 'admin')
    expect(await buttonsFor(task())).toEqual(['Edit', 'Delete'])
  })

  it('shows the owner name to an admin', async () => {
    signIn(STRANGER_ID, 'admin')
    const wrapper = await mountSuspended(TaskRow, { props: { task: task() } })

    expect(wrapper.text()).toContain('Regular User')
  })

  it('hides the owner name from a regular user', async () => {
    signIn(OWNER_ID)
    const wrapper = await mountSuspended(TaskRow, { props: { task: task() } })

    expect(wrapper.text()).not.toContain('Regular User')
  })
})

describe('TaskRow rendering', () => {
  beforeEach(() => {
    signIn(OWNER_ID)
  })

  it('emits edit and delete with the task attached', async () => {
    const subject = task()
    const wrapper = await mountSuspended(TaskRow, { props: { task: subject } })
    const [edit, remove] = wrapper.findAll('button')

    await edit!.trigger('click')
    await remove!.trigger('click')

    expect(wrapper.emitted('edit')?.[0]).toEqual([subject])
    expect(wrapper.emitted('delete')?.[0]).toEqual([subject])
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
})
