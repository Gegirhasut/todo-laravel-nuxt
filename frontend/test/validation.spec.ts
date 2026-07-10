import { describe, expect, it } from 'vitest'
import { toPayload, validateTask, type TaskFormValues } from '~/utils/validation'

function form(overrides: Partial<TaskFormValues> = {}): TaskFormValues {
  return {
    title: 'Valid title',
    description: '',
    due_date: '',
    status: 'pending',
    ...overrides,
  }
}

describe('validateTask', () => {
  it('accepts a valid task', () => {
    expect(validateTask(form())).toEqual({})
  })

  it('requires a title', () => {
    expect(validateTask(form({ title: '   ' }))).toHaveProperty('title')
  })

  it('rejects a title shorter than 3 characters', () => {
    expect(validateTask(form({ title: 'ab' })).title).toMatch(/at least 3/)
  })

  it('rejects a title longer than 255 characters', () => {
    expect(validateTask(form({ title: 'a'.repeat(256) })).title).toMatch(/255/)
  })

  it('rejects a malformed date', () => {
    expect(validateTask(form({ due_date: 'not-a-date' }))).toHaveProperty('due_date')
  })

  it('accepts an empty date, which is nullable', () => {
    expect(validateTask(form({ due_date: '' }))).not.toHaveProperty('due_date')
  })

  it('rejects a status outside the enum', () => {
    expect(validateTask(form({ status: 'archived' }))).toHaveProperty('status')
  })

  it('reports every broken field at once', () => {
    const errors = validateTask(form({ title: '', due_date: 'nope', status: 'archived' }))
    expect(Object.keys(errors).sort()).toEqual(['due_date', 'status', 'title'])
  })
})

describe('toPayload', () => {
  it('trims the title and nullifies an empty description and date', () => {
    expect(toPayload(form({ title: '  Hello  ', description: '   ', due_date: '' }))).toEqual({
      title: 'Hello',
      description: null,
      due_date: null,
      status: 'pending',
    })
  })

  it('keeps the values that were filled in', () => {
    expect(
      toPayload(form({ title: 'Ship it', description: 'Today', due_date: '2026-08-01', status: 'completed' })),
    ).toEqual({
      title: 'Ship it',
      description: 'Today',
      due_date: '2026-08-01',
      status: 'completed',
    })
  })
})
