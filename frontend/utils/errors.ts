import type { ApiError } from '~/types'

/**
 * ofetch wraps the parsed response body of a failed request in `error.data`,
 * which for this API is always an { message, errors? } object.
 */
export function apiError(error: unknown): ApiError | null {
  const data = (error as { data?: unknown })?.data
  if (data && typeof data === 'object' && 'message' in data) {
    return data as ApiError
  }
  return null
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  return apiError(error)?.message ?? fallback
}
