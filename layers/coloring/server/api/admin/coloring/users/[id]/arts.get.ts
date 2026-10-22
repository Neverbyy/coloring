import { and, desc, eq, isNotNull, max, or, sql } from 'drizzle-orm'
import { users } from '~~/server/db/schema'
import { adminDrawingApiPath, type AdminDrawing } from '#layers/coloring/shared/admin'
import { coloringArtOpens, coloringArts, coloringDrawings } from '#layers/coloring/server/db/schema'

function toIso(value: Date | string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null
}

export default defineAdminHandler(async (event): Promise<AdminDrawing[]> => {
  const userId = userIdParam(event)
  const db = useDb()
  const [player] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!player) throw createError({ statusCode: 404, message: 'Игрок не найден' })

  const opens = db
    .select({
      artId: coloringArtOpens.artId,
      lastOpenedAt: max(coloringArtOpens.openedAt).as('last_opened_at')
    })
    .from(coloringArtOpens)
    .where(eq(coloringArtOpens.userId, userId))
    .groupBy(coloringArtOpens.artId)
    .as('player_opens')

  const rows = await db
    .select({
      id: coloringArts.id,
      title: coloringArts.title,
      imageUrl: coloringArts.imageUrl,
      width: coloringArts.width,
      height: coloringArts.height,
      ownerId: coloringArts.ownerId,
      published: coloringArts.published,
      publishedAt: coloringArts.publishedAt,
      hasSvg: hasSvgField,
      drawn: isNotNull(coloringDrawings.userId).mapWith(Boolean),
      progress: coloringDrawings.progress,
      thumbnailUpdatedAt: coloringDrawings.thumbnailUpdatedAt,
      startedAt: coloringDrawings.startedAt,
      completedAt: coloringDrawings.completedAt,
      updatedAt: coloringDrawings.updatedAt,
      lastOpenedAt: opens.lastOpenedAt
    })
    .from(coloringArts)
    .leftJoin(coloringDrawings, and(eq(coloringDrawings.artId, coloringArts.id), eq(coloringDrawings.userId, userId)))
    .leftJoin(opens, eq(opens.artId, coloringArts.id))
    .where(or(isNotNull(coloringDrawings.userId), isNotNull(opens.artId), eq(coloringArts.ownerId, userId)))
    .orderBy(desc(sql`coalesce(${coloringDrawings.updatedAt}, ${opens.lastOpenedAt}, ${coloringArts.createdAt})`))

  return rows.map(row => ({
    art: {
      id: row.id,
      title: row.title,
      image: adminArtImage(row),
      width: row.width,
      height: row.height,
      own: row.ownerId === userId,
      status: artStatus(row.published, row.publishedAt)
    },
    progress: row.progress ?? 0,
    thumbnail: row.thumbnailUpdatedAt
      ? adminDrawingApiPath(userId, row.id, `/thumbnail?v=${new Date(row.thumbnailUpdatedAt).getTime()}`)
      : null,
    drawn: row.drawn,
    lastOpenedAt: toIso(row.lastOpenedAt),
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    updatedAt: row.drawn ? toIso(row.updatedAt) : null
  }))
})
