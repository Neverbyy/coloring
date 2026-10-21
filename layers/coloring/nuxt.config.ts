import { COLORING_MUSIC } from './shared/sounds'

// Игра «Раскраска» — отдельный Nuxt-слой. Платформа (вход, сессия, админка) живёт в корневом app/
export default defineNuxtConfig({
  hooks: {
    // У всех экранов игры — её фоновая музыка (meta.music играет платформа)
    'pages:extend'(pages) {
      for (const page of pages) {
        if (page.path === '/coloring' || page.path.startsWith('/coloring/')) {
          page.meta = { ...page.meta, music: COLORING_MUSIC }
        }
      }
    }
  }
})
