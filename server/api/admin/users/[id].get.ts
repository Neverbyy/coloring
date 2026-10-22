import { eq } from 'drizzle-orm'
import { users } from '../../../db/schema'

export default defineAdminHandler(async (event): Promise<AdminPlayer> => {
  const [row] = await useDb()
    .select(adminPlayerFields)
    .from(users)
    .where(eq(users.id, userIdParam(event)))
    .limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'Игрок не найден' })
  return toAdminPlayer(row)
})
