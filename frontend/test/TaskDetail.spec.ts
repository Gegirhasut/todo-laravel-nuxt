import { mockNuxtImport } from '@nuxt/test-utils/runtime'
// TaskDetail has no async setup, so a plain mount is enough — and it avoids
// a mountSuspended quirk with re-rendered conditional slots.
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskDetail from '~/components/TaskDetail.vue'
import type { Role, Task, User } from '~/types'

const auth = vi.hoisted(() => ({
  user: null as User | null,
  isAdmin: false,
}))

const tasksStore = vi.hoisted(() => ({
  updateTask: vi.fn(),
  createTask: vi.fn(),
}))

mockNuxtImport('useAuthStore', () => () => auth)
mockNuxtImport('useTasksStore', () => () => tasksStore)

const OWNER_ID = 7
const STRANGER_ID = 99

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    user_id: OWNER_ID,
    title: 'Купить молоко',
    description: 'Цельное молоко,\nдва литра.',
    due_date: '2026-08-01',
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

/** The footer bar buttons; while the form is open: [Сохранить, Отмена, Удалить]. */
const footerButtons = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('.detail-actions button')

/** Click «Изменить» and wait for the form. */
async function enterEdit(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.detail-actions .btn-ghost').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  auth.user = null
  auth.isAdmin = false
  tasksStore.updateTask.mockReset()
  tasksStore.createTask.mockReset()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('TaskDetail — read mode', () => {
  it('is a plain document: text, static badge, no editors, no pencils', async () => {
    signIn(OWNER_ID)
    const wrapper = mount(TaskDetail, { props: { task: task() } })

    expect(wrapper.find('.detail-title').text()).toContain('Купить молоко')
    expect(wrapper.find('.badge').text()).toContain('Ожидает')
    expect(wrapper.find('.control-desc').text()).toContain('два литра')
    expect(wrapper.text()).toContain('2026')

    // Nothing on the card edits on click — reading and copying only.
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('.pencil').exists()).toBe(false)
    // The only interactive elements are the footer's two buttons.
    expect(footerButtons(wrapper).map((b) => b.text())).toEqual(['Изменить', 'Удалить'])
  })

  it('does not strike through a completed title — the badge says it', async () => {
    signIn(OWNER_ID)
    const wrapper = mount(TaskDetail, { props: { task: task({ status: 'completed' }) } })

    expect(wrapper.find('.detail-title').classes()).not.toContain('done')
    expect(wrapper.find('.badge').text()).toContain('Выполнено')
  })

  it('shows a subtle «Без срока» when the task has no deadline', async () => {
    signIn(OWNER_ID)
    const wrapper = mount(TaskDetail, { props: { task: task({ due_date: null }) } })

    expect(wrapper.text()).toContain('Без срока')
  })

  it('is completely inert for a user who does not own the task', async () => {
    signIn(STRANGER_ID)
    const wrapper = mount(TaskDetail, { props: { task: task() } })

    expect(wrapper.find('.detail-actions').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('.badge').text()).toContain('Ожидает')
  })

  it('shows the owner name to an admin, and only to an admin', async () => {
    signIn(STRANGER_ID, 'admin')
    const asAdmin = mount(TaskDetail, { props: { task: task() } })
    expect(asAdmin.text()).toContain('Regular User')

    signIn(STRANGER_ID)
    const asUser = mount(TaskDetail, { props: { task: task() } })
    expect(asUser.text()).not.toContain('Regular User')
  })

  it('emits delete with the task attached', async () => {
    signIn(OWNER_ID)
    const subject = task()
    const wrapper = mount(TaskDetail, { props: { task: subject } })

    await wrapper.find('.detail-actions .btn-danger').trigger('click')

    expect(wrapper.emitted('delete')?.[0]).toEqual([subject])
  })

  it('renders each state on its own: loading, forbidden, not found, error', async () => {
    signIn(OWNER_ID)

    const loading = mount(TaskDetail, { props: { task: null, pending: true } })
    expect(loading.text()).toContain('Загрузка задачи…')

    const forbidden = mount(TaskDetail, { props: { task: null, error: 'forbidden' } })
    expect(forbidden.text()).toContain('Нет доступа к этой задаче.')

    const missing = mount(TaskDetail, { props: { task: null, error: 'notfound' } })
    expect(missing.text()).toContain('Задача не найдена.')

    const failed = mount(TaskDetail, { props: { task: null, error: 'other' } })
    expect(failed.text()).toContain('Не удалось загрузить задачу.')

    await failed.find('button').trigger('click')
    expect(failed.emitted('retry')).toHaveLength(1)
  })
})

describe('TaskDetail — edit mode', () => {
  beforeEach(() => signIn(OWNER_ID))

  it('«Изменить» opens the full form, seeded and scrolled into view', async () => {
    const wrapper = mount(TaskDetail, { props: { task: task() } })

    await enterEdit(wrapper)

    expect(wrapper.find<HTMLInputElement>('input[type="text"]').element.value).toBe('Купить молоко')
    expect(wrapper.find<HTMLSelectElement>('select').element.value).toBe('pending')
    expect(wrapper.find<HTMLInputElement>('input[type="date"]').element.value).toBe('2026-08-01')
    expect(wrapper.find<HTMLTextAreaElement>('textarea').element.value).toContain('два литра')
    expect(footerButtons(wrapper).map((b) => b.text())).toEqual(['Сохранить', 'Отмена', 'Удалить'])
    // The button sits at the card's bottom; the form top is deliberately revealed.
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    })
    expect(wrapper.emitted('editingChange')?.at(-1)).toEqual([true])
  })

  it('saves the whole form and returns to read mode with the fresh task', async () => {
    const updated = task({ title: 'Купить овсяное молоко', status: 'in_progress' })
    tasksStore.updateTask.mockResolvedValue(updated)
    const wrapper = mount(TaskDetail, { props: { task: task() } })

    await enterEdit(wrapper)
    await wrapper.find('input[type="text"]').setValue('Купить овсяное молоко')
    await wrapper.find('select').setValue('in_progress')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(tasksStore.updateTask).toHaveBeenCalledWith(1, expect.objectContaining({
      title: 'Купить овсяное молоко',
      status: 'in_progress',
      due_date: '2026-08-01',
    }))
    expect(wrapper.emitted('saved')?.[0]).toEqual([updated])
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.emitted('editingChange')?.at(-1)).toEqual([false])
  })

  it('«Отмена» discards the draft and read mode shows the original', async () => {
    const wrapper = mount(TaskDetail, { props: { task: task() } })

    await enterEdit(wrapper)
    await wrapper.find('input[type="text"]').setValue('Испорченное название')
    await footerButtons(wrapper)[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('.detail-title').text()).toContain('Купить молоко')
    expect(tasksStore.updateTask).not.toHaveBeenCalled()

    // Re-entering starts from the task again, not the discarded draft.
    await enterEdit(wrapper)
    expect(wrapper.find<HTMLInputElement>('input[type="text"]').element.value).toBe('Купить молоко')
  })

  it('Esc cancels the edit without saving', async () => {
    const wrapper = mount(TaskDetail, { props: { task: task() }, attachTo: document.body })

    await enterEdit(wrapper)
    wrapper
      .find('textarea')
      .element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(tasksStore.updateTask).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('rejects a too-short title without calling the API', async () => {
    const wrapper = mount(TaskDetail, { props: { task: task() } })

    await enterEdit(wrapper)
    await wrapper.find('input[type="text"]').setValue('ab')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.field-error').text()).toBe('Название должно содержать минимум 3 символа.')
    expect(tasksStore.updateTask).not.toHaveBeenCalled()
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('maps a 422 from the API back onto the field and stays in edit', async () => {
    tasksStore.updateTask.mockRejectedValue(
      Object.assign(new Error('422'), {
        data: {
          message: 'Название не должно превышать 255 символов.',
          errors: { title: ['Название не должно превышать 255 символов.'] },
        },
      }),
    )
    const wrapper = mount(TaskDetail, { props: { task: task() } })

    await enterEdit(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.field-error').text()).toContain('255')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})

describe('TaskDetail — create mode', () => {
  beforeEach(() => signIn(OWNER_ID))

  it('renders an empty editable card straight away', async () => {
    const wrapper = mount(TaskDetail, { props: { task: null, mode: 'create' } })

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find<HTMLInputElement>('input[type="text"]').element.value).toBe('')
    expect(wrapper.find<HTMLSelectElement>('select').element.value).toBe('pending')
  })

  it('client validation blocks an empty title without calling the API', async () => {
    const wrapper = mount(TaskDetail, { props: { task: null, mode: 'create' } })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.field-error').text()).toBe('Укажите название задачи.')
    expect(tasksStore.createTask).not.toHaveBeenCalled()
  })

  it('creates through the create action and emits the new task', async () => {
    const created = task({ id: 33, title: 'Новая задача из формы' })
    tasksStore.createTask.mockResolvedValue(created)
    const wrapper = mount(TaskDetail, { props: { task: null, mode: 'create' } })

    await wrapper.find('input[type="text"]').setValue('Новая задача из формы')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(tasksStore.createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Новая задача из формы',
      status: 'pending',
    }))
    expect(wrapper.emitted('created')?.[0]).toEqual([created])
  })

  it('«Отмена» in create mode asks the parent to leave', async () => {
    const wrapper = mount(TaskDetail, { props: { task: null, mode: 'create' } })

    await wrapper.find('.detail-actions .btn-ghost').trigger('click')

    expect(wrapper.emitted('cancelCreate')).toHaveLength(1)
    expect(tasksStore.createTask).not.toHaveBeenCalled()
  })
})
