import type { TaskPayload, TaskStatus } from '~/types'

export const TASK_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed']

export interface TaskFormValues {
  title: string
  description: string
  due_date: string
  status: string
}

/**
 * Client-side validation mirroring the backend Form Request rules, so the
 * obvious mistakes are caught without a round trip. The server still has the
 * final say — its 422 errors are mapped back onto the form.
 *
 * Returns a field -> message map; an empty map means the form is valid.
 */
export function validateTask(values: TaskFormValues): Record<string, string> {
  const errors: Record<string, string> = {}

  const title = values.title.trim()
  if (!title) {
    errors.title = 'Title is required.'
  } else if (title.length < 3) {
    errors.title = 'Title must be at least 3 characters.'
  } else if (title.length > 255) {
    errors.title = 'Title must not exceed 255 characters.'
  }

  if (values.due_date && Number.isNaN(Date.parse(values.due_date))) {
    errors.due_date = 'Please enter a valid date.'
  }

  if (!TASK_STATUSES.includes(values.status as TaskStatus)) {
    errors.status = 'Please choose a valid status.'
  }

  return errors
}

export function toPayload(values: TaskFormValues): TaskPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    due_date: values.due_date || null,
    status: values.status as TaskStatus,
  }
}
