export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.admin) return
  const auth = useAuthStore()
  if (!auth.loaded) await auth.fetchUser()

  if (to.meta.guestOnly) {
    if (auth.user) return navigateTo(safeRedirect(to.query.redirect))
    return
  }

  if (!auth.user) {
    return navigateTo({ path: '/login', query: to.fullPath === HOME_PATH ? undefined : { redirect: to.fullPath } })
  }
})
