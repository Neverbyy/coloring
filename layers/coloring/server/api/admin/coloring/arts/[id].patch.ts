import { eq } from 'drizzle-orm'
import { GALLERY_SIGNAL, MAX_ART_TITLE } from '#layers/coloring/shared/gallery'
import type { AdminArtDetails } from '#layers/coloring/shared/admin'
import { coloringArts } from '#layers/coloring/server/db/schema'

function badRequest(message: string): never {
  throw createError({ statusCode: 400, message })
}

export default defineAdminHandler(async (event): Promise<AdminArtDetails> => {
  const id = artIdParam(event)
  const art = await requireAdminArt(id)
  const body = await readBody<Record<string, unknown> | null>(event)
  const set: Partial<typeof coloringArts.$inferInsert> = {}

  if (body?.title !== undefined) {
    if (typeof body.title !== 'string') badRequest('Неверное название')
    const title = body.title.replace(/[\p{Cc}\s]+/gu, ' ').trim()
    if (!title) badRequest('Название не может быть пустым')
    if ([...title].length > MAX_ART_TITLE) badRequest(`Название — до ${MAX_ART_TITLE} символов`)
    set.title = title
  }

  if (body?.published !== undefined) {
    if (typeof body.published !== 'boolean') badRequest('Неверный статус')
    set.published = body.published
    if (body.published && !art.publishedAt) set.publishedAt = new Date()
  }

  if (Object.keys(set).length > 0) {
    await useDb().update(coloringArts).set(set).where(eq(coloringArts.id, id))
    if (art.published || set.published) await broadcastSignal(GALLERY_SIGNAL.channel, GALLERY_SIGNAL.event)
  }
  return getAdminArt(id)
})
