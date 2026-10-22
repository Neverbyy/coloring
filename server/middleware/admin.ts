export default defineEventHandler(async (event) => {
  if (isProtectedAdminPath(event.path)) await requireAdmin(event)
})
