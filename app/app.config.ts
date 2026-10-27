export default defineAppConfig({
  games: [] as GameEntry[],
  admin: {
    sections: [
      { to: '/admin', label: 'Обзор' },
      { to: '/admin/users', label: 'Игроки' }
    ] as AdminSection[],
    userTabs: [] as AdminUserTab[]
  }
})
