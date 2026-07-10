import { defineStore } from 'pinia'

export type ToastType = 'success' | 'error'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

/** How long a toast stays on screen before it dismisses itself. */
export const TOAST_TTL_MS = 4000

export const useToastsStore = defineStore('toasts', () => {
  const items = ref<Toast[]>([])
  let lastId = 0

  function dismiss(id: number) {
    items.value = items.value.filter((toast) => toast.id !== id)
  }

  function push(message: string, type: ToastType = 'success'): number {
    const id = ++lastId
    items.value.push({ id, type, message })

    if (import.meta.client) {
      setTimeout(() => dismiss(id), TOAST_TTL_MS)
    }

    return id
  }

  const success = (message: string) => push(message, 'success')
  const error = (message: string) => push(message, 'error')

  return { items, push, success, error, dismiss }
})
