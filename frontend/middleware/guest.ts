// Route guard: keep already-authenticated users away from the login page.
export default defineNuxtRouteMiddleware(() => {
  const auth = useAuthStore()

  if (auth.isAuthenticated) {
    return navigateTo('/')
  }
})
