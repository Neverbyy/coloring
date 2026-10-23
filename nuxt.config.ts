import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  typescript: {
    strict: true,
    typeCheck: false
  },
  runtimeConfig: {
    databaseUrl: '',
    supabaseSecretKey: '',
    public: {
      supabaseUrl: '',
      supabasePublishableKey: ''
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Раскраска',
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
      meta: [
        { name: 'theme-color', content: '#71c5ef' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Rubik+Bubbles&family=Rubik:wght@500;700&display=swap'
        }
      ]
    }
  },
  css: ['~/assets/styles/main.scss'],
  routeRules: {
    '/admin': { ssr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/admin/**': { ssr: false, headers: { 'x-robots-tag': 'noindex, nofollow' } }
  },
  nitro: {
    publicAssets: [
      {
        baseURL: 'flags',
        dir: fileURLToPath(new URL('./node_modules/flag-icons/flags/4x3', import.meta.url)),
        maxAge: 60 * 60 * 24 * 30
      }
    ]
  },
  vite: {
    optimizeDeps: {
      include: ['@tanstack/vue-query', '@supabase/realtime-js']
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/variables" as *;\n'
        }
      }
    }
  }
})
