export default defineAppConfig({
  admin: {
    sections: [
      { to: '/admin', label: 'Обзор' },
      { to: '/admin/users', label: 'Игроки' }
    ] as AdminSection[],
    userTabs: [] as AdminUserTab[]
  }
})
