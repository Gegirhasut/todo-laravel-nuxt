/**
 * After a reload only the token cookie survives, so pull the profile back in
 * before the first route renders. Runs after plugins/api.ts (alphabetical
 * order), which is what provides $api.
 */
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()

  if (auth.isAuthenticated && !auth.user) {
    await auth.fetchUser()
  }
})
