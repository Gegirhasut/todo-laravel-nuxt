/** Stamp the chosen theme onto <html> before the first paint. */
export default defineNuxtPlugin(() => {
  useTheme().apply()
})
