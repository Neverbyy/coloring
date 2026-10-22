import { and, count, desc, eq, like, type SQL } from 'drizzle-orm'
import { users } from '../../../db/schema'

const PAGE_SIZE = 50

export default defineAdminHandler(async (event): Promise<AdminPlayerPage> => {
  const query = getQuery(event)
  const filters: SQL[] = []
  const search = typeof query.q === 'string' ? usernameKey(query.q) : ''
  if (search) filters.push(like(users.usernameKey, `%${escapeLike(search)}%`))
  if (isCountryCode(query.country)) filters.push(eq(users.country, query.country))
  const where = filters.length ? and(...filters) : undefined

  const db = useDb()
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(users).where(where)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(pageQuery(event), pageCount)
  const rows = await db
    .select(adminPlayerFields)
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), users.id)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  return {
    items: rows.map(toAdminPlayer),
    page,
    pageCount,
    total
  }
})
