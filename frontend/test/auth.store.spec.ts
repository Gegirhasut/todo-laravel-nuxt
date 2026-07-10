import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '~/stores/auth'

const apiMock = vi.fn()

mockNuxtImport('useApi', () => () => apiMock)

/** Mimics how ofetch surfaces a failed response: the body sits on `data`. */
function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { status, data })
}

describe('auth store login', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    document.cookie = 'auth_token=; Max-Age=0; path=/'
  })

  it('stores the token and the user after a successful login', async () => {
    apiMock.mockResolvedValue({
      token: 'tok_123',
      user: { id: 1, name: 'Regular User', email: 'user@example.com', role: 'user' },
    })

    const auth = useAuthStore()
    const ok = await auth.login('user@example.com', 'password')

    expect(ok).toBe(true)
    expect(auth.token).toBe('tok_123')
    expect(auth.user?.email).toBe('user@example.com')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isAdmin).toBe(false)
    expect(auth.error).toBeNull()

    expect(apiMock).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com', password: 'password' },
    })
  })

  it('recognises an admin', async () => {
    apiMock.mockResolvedValue({
      token: 'tok_admin',
      user: { id: 2, name: 'Admin User', email: 'admin@example.com', role: 'admin' },
    })

    const auth = useAuthStore()
    await auth.login('admin@example.com', 'password')

    expect(auth.isAdmin).toBe(true)
  })

  it('surfaces the 422 field error on wrong credentials and stays signed out', async () => {
    apiMock.mockRejectedValue(
      httpError(422, {
        message: 'The provided credentials are incorrect.',
        errors: { email: ['The provided credentials are incorrect.'] },
      }),
    )

    const auth = useAuthStore()
    const ok = await auth.login('user@example.com', 'wrong')

    expect(ok).toBe(false)
    expect(auth.error).toBe('The provided credentials are incorrect.')
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('falls back to a generic message when the server sends nothing useful', async () => {
    apiMock.mockRejectedValue(new Error('Network down'))

    const auth = useAuthStore()

    expect(await auth.login('user@example.com', 'password')).toBe(false)
    expect(auth.error).toBe('Login failed. Please try again.')
  })

  it('is not left loading once a login fails', async () => {
    apiMock.mockRejectedValue(httpError(500, { message: 'Server error.' }))

    const auth = useAuthStore()
    await auth.login('user@example.com', 'password')

    expect(auth.loading).toBe(false)
    expect(auth.error).toBe('Server error.')
  })

  it('clearSession drops both the token and the user', () => {
    const auth = useAuthStore()
    auth.token = 'tok_123'
    auth.user = { id: 1, name: 'Regular User', email: 'user@example.com', role: 'user' }

    auth.clearSession()

    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })
})
