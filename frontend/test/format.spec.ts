import { describe, expect, it } from 'vitest'
import { formatDate, isOverdue, statusLabel } from '~/utils/format'

describe('statusLabel', () => {
  it('turns enum values into human labels', () => {
    expect(statusLabel('pending')).toBe('Ожидает')
    expect(statusLabel('in_progress')).toBe('В работе')
    expect(statusLabel('completed')).toBe('Выполнено')
  })
})

describe('formatDate', () => {
  it('shows a dash when there is no date', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('formats an ISO date', () => {
    expect(formatDate('2026-01-15')).toContain('2026')
  })

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('keeps the calendar day of a date-only string in every timezone', () => {
    // new Date('2026-01-15') would be UTC midnight — the 14th anywhere west
    // of Greenwich. Parsing as local components keeps it the 15th.
    expect(formatDate('2026-01-15')).toContain('15')
  })
})

describe('isOverdue', () => {
  it('is false for a completed task, however old the deadline', () => {
    expect(isOverdue('2000-01-01', 'completed')).toBe(false)
  })

  it('is false when there is no deadline', () => {
    expect(isOverdue(null, 'pending')).toBe(false)
  })

  it('is true for a past deadline on an open task', () => {
    expect(isOverdue('2000-01-01', 'pending')).toBe(true)
    expect(isOverdue('2000-01-01', 'in_progress')).toBe(true)
  })

  it('is false for a deadline in the future', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
    expect(isOverdue(future, 'pending')).toBe(false)
  })

  it('does not mark a task due today as overdue, whatever the timezone', () => {
    const now = new Date()
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')

    expect(isOverdue(today, 'pending')).toBe(false)
  })
})
