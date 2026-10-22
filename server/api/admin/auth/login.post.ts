export default defineEventHandler(async (event): Promise<SessionAdmin> => {
  const body = await readBody<{ username?: unknown, password?: unknown } | null>(event)
  return loginAdmin(event, body?.username, body?.password)
})
