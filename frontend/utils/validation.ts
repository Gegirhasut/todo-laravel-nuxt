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
    errors.title = 'Укажите название задачи.'
  } else if (title.length < 3) {
    errors.title = 'Название должно содержать минимум 3 символа.'
  } else if (title.length > 255) {
    errors.title = 'Название не должно превышать 255 символов.'
  }

  if (values.due_date && Number.isNaN(Date.parse(values.due_date))) {
    errors.due_date = 'Укажите корректную дату.'
  }

  if (!TASK_STATUSES.includes(values.status as TaskStatus)) {
    errors.status = 'Выберите допустимый статус.'
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
