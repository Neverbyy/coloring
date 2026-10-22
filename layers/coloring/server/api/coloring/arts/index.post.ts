import { count, eq } from 'drizzle-orm'
import { MAX_OWN_ARTS, type ImportResult } from '#layers/coloring/shared/gallery'
import { coloringArts } from '#layers/coloring/server/db/schema'

export default defineEventHandler(async (event): Promise<ImportResult> => {
  const user = await requireUser(event)
  const db = useDb()
  const [own] = await db.select({ total: count() }).from(coloringArts).where(eq(coloringArts.ownerId, user.id))
  if ((own?.total ?? 0) >= MAX_OWN_ARTS) {
    throw createError({ statusCode: 409, message: `Можно загрузить до ${MAX_OWN_ARTS} рисунков — удали старые` })
  }

  const upload = await readSvgUpload(event, 'Мой рисунок')
  const [row] = await db.insert(coloringArts)
    .values({ ...upload.values, ownerId: user.id })
    .onConflictDoNothing({ target: [coloringArts.ownerId, coloringArts.svgHash] })
    .returning()
  if (!row) throw createError({ statusCode: 409, message: 'Этот рисунок уже есть в твоей галерее' })

  return {
    art: toGalleryArt(row, { progress: null, thumbnailUpdatedAt: null, hasBase: null }),
    notes: upload.notes
  }
})
