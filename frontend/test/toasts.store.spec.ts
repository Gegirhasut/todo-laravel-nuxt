import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOAST_TTL_MS, useToastsStore } from '~/stores/toasts'

describe('toasts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a success toast', () => {
    const toasts = useToastsStore()
    toasts.success('Задача создана.')

    expect(toasts.items).toHaveLength(1)
    expect(toasts.items[0]!.type).toBe('success')
    expect(toasts.items[0]!.message).toBe('Задача создана.')
  })

  it('shows an error toast', () => {
    const toasts = useToastsStore()
    toasts.error('Не удалось удалить задачу.')

    expect(toasts.items[0]!.type).toBe('error')
  })

  it('dismisses a toast on its own after the timeout', () => {
    const toasts = useToastsStore()
    toasts.success('Задача обновлена.')

    vi.advanceTimersByTime(TOAST_TTL_MS - 1)
    expect(toasts.items).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(toasts.items).toHaveLength(0)
  })

  it('dismisses only the toast that was closed', () => {
    const toasts = useToastsStore()
    const first = toasts.success('Первая.')
    toasts.success('Вторая.')

    toasts.dismiss(first)

    expect(toasts.items).toHaveLength(1)
    expect(toasts.items[0]!.message).toBe('Вторая.')
  })

  it('stacks several toasts with distinct ids', () => {
    const toasts = useToastsStore()
    const a = toasts.success('Задача создана.')
    const b = toasts.success('Задача удалена.')

    expect(a).not.toBe(b)
    expect(toasts.items).toHaveLength(2)
  })
})
