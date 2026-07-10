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
    expect(await buttonsFor(task())).toEqual(['Изменить', 'Удалить'])
  })

  it('hides Edit and Delete from a user who does not own the task', async () => {
    signIn(STRANGER_ID)
    expect(await buttonsFor(task())).toEqual([])
  })

  it('shows Edit and Delete to an admin, even on a task they do not own', async () => {
    signIn(STRANGER_ID, 'admin')
    expect(await buttonsFor(task())).toEqual(['Изменить', 'Удалить'])
  })

  it('shows the owner name when the list mixes owners', async () => {
    signIn(STRANGER_ID, 'admin')
    const wrapper = await mountSuspended(TaskRow, { props: { task: task(), showOwner: true } })

    expect(wrapper.text()).toContain('Regular User')
  })

  it('hides the owner name in a list of the user own tasks', async () => {
    signIn(OWNER_ID)
    const wrapper = await mountSuspended(TaskRow, { props: { task: task() } })

    expect(wrapper.text()).not.toContain('Regular User')
  })
})

describe('TaskRow in the shared "all tasks" list', () => {
  beforeEach(() => {
    auth.user = null
    auth.isAdmin = false
  })

  it('marks the user own task and keeps its buttons', async () => {
    signIn(OWNER_ID)
    const wrapper = await mountSuspended(TaskRow, { props: { task: task(), showOwner: true } })

    expect(wrapper.find('.badge-own').text()).toBe('Моя')
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['Изменить', 'Удалить'])
    // The badge says it already — no need to repeat the owner's name.
    expect(wrapper.text()).not.toContain('Regular User')
  })

  it('leaves a foreign task unmarked and read-only', async () => {
    signIn(STRANGER_ID)
    const wrapper = await mountSuspended(TaskRow, { props: { task: task(), showOwner: true } })

    expect(wrapper.find('.badge-own').exists()).toBe(false)
    expect(wrapper.text()).toContain('Regular User')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('marks an admin own task, and still lets them manage a foreign one', async () => {
    signIn(OWNER_ID, 'admin')
    const own = await mountSuspended(TaskRow, { props: { task: task(), showOwner: true } })
    expect(own.find('.badge-own').exists()).toBe(true)
    expect(own.findAll('button')).toHaveLength(2)

    const foreign = await mountSuspended(TaskRow, {
      props: { task: task({ user_id: STRANGER_ID }), showOwner: true },
    })
    expect(foreign.find('.badge-own').exists()).toBe(false)
    expect(foreign.findAll('button')).toHaveLength(2)
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
