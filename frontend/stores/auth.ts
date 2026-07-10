import { defineStore } from 'pinia'
import type { User } from '~/types'

interface LoginResponse {
  token: string
  user: User
}

export const useAuthStore = defineStore('auth', () => {
  // The token lives in a cookie so a page reload keeps the session.
  const token = useCookie<string | null>('auth_token', {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  })

  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function clearSession() {
    token.value = null
    user.value = null
  }

  async function login(email: string, password: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const res = await useApi()<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      token.value = res.token
      user.value = res.user
      return true
    } catch (e) {
      const body = apiError(e)
      // Bad credentials come back as a 422 on the email field.
      error.value =
        body?.errors?.email?.[0] ?? body?.message ?? 'Login failed. Please try again.'
      return false
    } finally {
      loading.value = false
    }
  }

  /** Restore the profile after a reload, when only the cookie survived. */
  async function fetchUser(): Promise<void> {
    if (!token.value) return

    try {
      const res = await useApi()<{ data: User }>('/user')
      user.value = res.data
    } catch {
      // A 401 is already handled by the API plugin: session cleared, redirected.
    }
  }

  async function logout(): Promise<void> {
    try {
      await useApi()('/auth/logout', { method: 'POST' })
    } catch {
      // The token may already be gone server-side; clear it locally regardless.
    } finally {
      clearSession()
      await navigateTo('/login')
    }
  }

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    fetchUser,
    clearSession,
  }
})
