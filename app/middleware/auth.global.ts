// Все страницы — только после входа, кроме отмеченных guestOnly (вход)
export default defineNuxtRouteMiddleware(async (to) => {
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
