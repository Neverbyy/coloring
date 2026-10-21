import { and, eq } from 'drizzle-orm'
import { coloringArts } from '../../../db/schema'

// Удалить свой импортированный арт; рисунки к нему удаляются каскадом
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const [deleted] = await useDb()
    .delete(coloringArts)
    .where(and(eq(coloringArts.id, artIdParam(event)), eq(coloringArts.ownerId, user.id)))
    .returning({ id: coloringArts.id })
  if (!deleted) throw artNotFound()
  setResponseStatus(event, 204)
  return null
})
