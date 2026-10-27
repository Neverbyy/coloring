export default defineAppConfig({
  games: [
    { id: 'coloring', title: 'Раскраска', to: '/coloring', cover: '/games/coloring.webp' }
  ] as GameEntry[],
  admin: {
    sections: [
      { to: '/admin/coloring/arts', label: 'Раскраски' },
      { to: '/admin/coloring/stats', label: 'Статистика' }
    ] as AdminSection[],
    userTabs: [
      { path: 'coloring', label: 'Раскраска' }
    ] as AdminUserTab[]
  }
})
