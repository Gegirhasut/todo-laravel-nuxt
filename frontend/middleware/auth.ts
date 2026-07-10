// Route guard: send anonymous visitors to the login page, remembering where
// they were headed.
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
