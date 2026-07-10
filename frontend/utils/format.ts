import type { TaskStatus } from '~/types'

const LABELS: Record<TaskStatus, string> = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  completed: 'Выполнено',
}

export function statusLabel(status: TaskStatus): string {
  return LABELS[status] ?? status
}

/**
 * Parse a date-only "YYYY-MM-DD" string as LOCAL midnight. `new Date(string)`
 * would read it as UTC midnight, which shifts the day in every timezone west
 * of Greenwich — a task due today would already render as overdue.
 */
function parseDateOnly(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) {
    const fallback = new Date(date)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

export function formatDate(date: string | null): string {
  if (!date) return '—'

  const parsed = parseDateOnly(date)
  if (!parsed) return date

  return parsed.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** A deadline in the past on a task that is not finished yet. */
export function isOverdue(date: string | null, status: TaskStatus): boolean {
  if (!date || status === 'completed') return false

  const due = parseDateOnly(date)
  if (!due) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return due.getTime() < today.getTime()
}
