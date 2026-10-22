import { COLORING_MUSIC } from './shared/sounds'

export default defineNuxtConfig({
  hooks: {
    'pages:extend'(pages) {
      for (const page of pages) {
        if (page.path === '/coloring' || page.path.startsWith('/coloring/')) {
          page.meta = { ...page.meta, music: COLORING_MUSIC }
        }
      }
    }
  }
})
