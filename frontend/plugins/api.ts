import { useAuthStore } from '~/stores/auth'

/**
 * One $fetch instance for the whole app. It is built inside a plugin (rather
 * than on demand in a composable) so the interceptors keep a valid Nuxt
 * context even when a request is fired from a store action long after setup.
 *
 * It prefixes the API base URL, attaches the Sanctum bearer token, asks for
 * JSON, and on a 401 drops the session and sends the user back to /login.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const router = useRouter()

  const api = $fetch.create({
    baseURL: config.public.apiBase,
    headers: { Accept: 'application/json' },

    onRequest({ options }) {
      const { token } = useAuthStore()
      if (token) {
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },

    async onResponseError({ response }) {
      if (response.status !== 401) return

      useAuthStore().clearSession()

      // Don't bounce if we are already sitting on the login page.
      if (router.currentRoute.value.path !== '/login') {
        await nuxtApp.runWithContext(() => navigateTo('/login'))
      }
    },
  })

  return {
    provide: { api },
  }
})
