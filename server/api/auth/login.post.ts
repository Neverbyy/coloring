export default defineEventHandler(async (event): Promise<SessionUser> => {
  const body = await readBody<{ country?: unknown, username?: unknown } | null>(event)
  const problem = validateLogin(body?.country, body?.username)
  if (problem) throw createError({ statusCode: 400, message: problem })

  const user = await findOrCreateUser(normalizeUsername(body!.username as string), body!.country as string)
  await createSession(event, user.id)
  return user
})
