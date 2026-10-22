import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { coloringArts } from '#layers/coloring/server/db/schema'

export async function requireDrawingRequest(event: H3Event): Promise<{ user: SessionUser, artId: string }> {
  const user = await requireUser(event)
  const id = artIdParam(event)
  const [art] = await useDb()
    .select({ id: coloringArts.id })
    .from(coloringArts)
    .where(and(eq(coloringArts.id, id), visibleTo(user)))
    .limit(1)
  if (!art) throw artNotFound()
  return { user, artId: art.id }
}
