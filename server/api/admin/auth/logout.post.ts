export default defineEventHandler(async (event) => {
  await destroyAdminSession(event)
  return { ok: true }
})
