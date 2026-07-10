/**
 * Access to the shared, authenticated $fetch instance created in plugins/api.ts.
 */
export function useApi() {
  return useNuxtApp().$api
}
