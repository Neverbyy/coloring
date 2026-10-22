export default defineAppConfig({
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
