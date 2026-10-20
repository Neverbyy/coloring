import { eq } from 'drizzle-orm'
import { users, type UserRow } from '../db/schema'

function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, username: row.username, country: row.country }
}

// Вход без пароля: имя уникально на весь сервис. Совпали имя и страна — это тот же игрок,
// имени нет — создаём, имя занято игроком из другой страны — отказ
export async function findOrCreateUser(username: string, country: string): Promise<SessionUser> {
  const db = useDb()
  const key = usernameKey(username)

  // Вторая попытка — на случай гонки: имя заняли между проверкой и вставкой
  for (let attempt = 0; attempt < 2; attempt++) {
    const [existing] = await db.select().from(users).where(eq(users.usernameKey, key)).limit(1)
    if (existing) {
      if (existing.country !== country) {
        throw createError({ statusCode: 409, message: 'Это имя уже занято — придумай другое' })
      }
      return toSessionUser(existing)
    }

    const [created] = await db
      .insert(users)
      .values({ username, usernameKey: key, country })
      .onConflictDoNothing({ target: users.usernameKey })
      .returning()
    if (created) return toSessionUser(created)
  }

  throw createError({ statusCode: 503, message: 'Не получилось войти, попробуй ещё раз' })
}
