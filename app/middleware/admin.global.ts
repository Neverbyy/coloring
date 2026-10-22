export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.meta.admin) return
  const store = useAdminStore()
  if (!store.loaded) await store.fetchAdmin().catch(() => {})

  if (to.path === ADMIN_LOGIN_PATH) {
    if (store.admin) return navigateTo(safeAdminRedirect(to.query.redirect))
    return
  }
  if (!store.admin) {
    return navigateTo({ path: ADMIN_LOGIN_PATH, query: to.fullPath === ADMIN_HOME_PATH ? undefined : { redirect: to.fullPath } })
  }
})
