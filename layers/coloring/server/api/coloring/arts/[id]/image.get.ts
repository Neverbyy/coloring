import { eq } from 'drizzle-orm'
import { coloringArts } from '../../../../db/schema'

// SVG импортированного арта — только тому, кому арт виден. Содержимое по id не меняется
export default defineEventHandler(async (event) => {
  const { artId } = await requireDrawingRequest(event)
  const [art] = await useDb().select({ svg: coloringArts.svg }).from(coloringArts).where(eq(coloringArts.id, artId)).limit(1)
  return sendImage(event, art?.svg ?? null, 'svg', IMMUTABLE_CACHE)
})
