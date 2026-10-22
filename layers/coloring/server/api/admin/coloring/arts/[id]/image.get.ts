import { eq } from 'drizzle-orm'
import { coloringArts } from '#layers/coloring/server/db/schema'

export default defineAdminHandler(async (event) => {
  const [art] = await useDb().select({ svg: coloringArts.svg }).from(coloringArts).where(eq(coloringArts.id, artIdParam(event))).limit(1)
  return sendImage(event, art?.svg ?? null, 'svg', IMMUTABLE_CACHE)
})
