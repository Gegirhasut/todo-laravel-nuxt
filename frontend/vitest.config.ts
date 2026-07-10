import { defineVitestConfig } from '@nuxt/test-utils/config'

// The "nuxt" environment boots a real Nuxt app for each test file, which gives
// the components and stores their auto-imports, plugins and Pinia instance.
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['test/**/*.spec.ts'],
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
      },
    },
  },
})
