import { and, eq, isNull } from 'drizzle-orm'
import { coloringArts } from '../../../../db/schema'

export default defineAdminHandler(async (event) => {
  const id = artIdParam(event)
  const art = await requireAdminArt(id)
  const [deleted] = art.publishedAt
    ? []
    : await useDb()
      .delete(coloringArts)
      .where(and(eq(coloringArts.id, id), isNull(coloringArts.ownerId), isNull(coloringArts.publishedAt)))
      .returning({ id: coloringArts.id })
  if (!deleted) {
    throw createError({ statusCode: 409, message: 'Опубликованный арт удалить нельзя — у игроков могут быть рисунки. Его можно скрыть' })
  }
  setResponseStatus(event, 204)
  return null
})
