// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  // Pure single-page app: the Laravel REST API is a separate service and the
  // bearer token lives in a browser cookie, so there is nothing worth
  // rendering on the server.
  ssr: false,

  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // Override with NUXT_PUBLIC_API_BASE — see .env.example. 127.0.0.1 rather
      // than localhost, because some machines resolve localhost to ::1 first
      // and `php artisan serve` only listens on IPv4.
      apiBase: 'http://127.0.0.1:8000/api',
    },
  },

  app: {
    head: {
      title: 'To-Do',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
