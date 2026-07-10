import type { TaskPayload } from '~/types'
import type { TaskFormValues } from '~/utils/validation'

/**
 * Shared task-form state: client validation mirroring the backend rules and
 * the mapping of a 422 response back onto the fields. Used by both the
 * create dialog and the inline editor, so the two behave identically.
 */
export function useTaskForm(initial: () => TaskFormValues) {
  const values = reactive<TaskFormValues>(initial())
  const errors = reactive<Record<string, string>>({})
  const serverError = ref<string | null>(null)
  const saving = ref(false)

  function replaceErrors(next: Record<string, string> = {}) {
    Object.keys(errors).forEach((key) => delete errors[key])
    Object.assign(errors, next)
  }

  /** Back to the initial values, with every error cleared. */
  function reset() {
    Object.assign(values, initial())
    replaceErrors()
    serverError.value = null
  }

  /**
   * Validate and run the given persist action. Returns its result, or null
   * when client validation or the API rejected — the errors are already on
   * the fields by then.
   */
  async function submit<T>(action: (payload: TaskPayload) => Promise<T>): Promise<T | null> {
    serverError.value = null

    const clientErrors = validateTask(values)
    replaceErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return null

    saving.value = true

    try {
      return await action(toPayload(values))
    } catch (e) {
      const body = apiError(e)

      if (body?.errors) {
        replaceErrors(
          Object.fromEntries(
            Object.entries(body.errors).map(([field, messages]) => [field, messages[0] as string]),
          ),
        )
      }

      serverError.value = body?.message ?? 'Не удалось сохранить задачу. Попробуйте ещё раз.'
      return null
    } finally {
      saving.value = false
    }
  }

  return { values, errors, serverError, saving, submit, reset }
}
