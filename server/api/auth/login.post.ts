export default defineEventHandler(async (event): Promise<SessionUser> => {
  const body = await readBody<{ country?: unknown, username?: unknown } | null>(event)

  if (!isCountryCode(body?.country)) {
    throw createError({ statusCode: 400, message: 'Выбери страну' })
  }
  if (typeof body?.username !== 'string') {
    throw createError({ statusCode: 400, message: 'Придумай имя' })
  }
  const problem = validateUsername(body.username)
  if (problem) throw createError({ statusCode: 400, message: problem })

  const user = await findOrCreateUser(normalizeUsername(body.username), body.country)
  await createSession(event, user.id)
  return user
})
