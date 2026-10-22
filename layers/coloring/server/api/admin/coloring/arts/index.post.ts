import { and, eq, isNull } from 'drizzle-orm'
import type { AdminArtUpload } from '../../../../../shared/admin'
import { coloringArts } from '../../../../db/schema'

export default defineAdminHandler(async (event): Promise<AdminArtUpload> => {
  const upload = await readSvgUpload(event, 'Новая раскраска')
  const db = useDb()
  const [existing] = await db
    .select({ id: coloringArts.id, title: coloringArts.title })
    .from(coloringArts)
    .where(and(isNull(coloringArts.ownerId), eq(coloringArts.svgHash, upload.values.svgHash)))
    .limit(1)
  if (existing) {
    throw createError({ statusCode: 409, message: `Этот рисунок уже загружен — «${existing.title}»`, data: { id: existing.id } })
  }

  await db.insert(coloringArts).values({ ...upload.values, published: false })
  return { id: upload.values.id, notes: upload.notes }
})
