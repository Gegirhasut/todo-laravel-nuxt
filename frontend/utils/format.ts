import type { TaskStatus } from '~/types'

const LABELS: Record<TaskStatus, string> = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  completed: 'Выполнено',
}

export function statusLabel(status: TaskStatus): string {
  return LABELS[status] ?? status
}

export function formatDate(date: string | null): string {
  if (!date) return '—'

  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date

  return parsed.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** A deadline in the past on a task that is not finished yet. */
export function isOverdue(date: string | null, status: TaskStatus): boolean {
  if (!date || status === 'completed') return false

  const due = new Date(date)
  if (Number.isNaN(due.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return due.getTime() < today.getTime()
}
