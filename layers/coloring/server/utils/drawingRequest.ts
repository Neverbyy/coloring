import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { coloringArts } from '../db/schema'

// Общее начало обработчиков рисунка (/api/coloring/arts/[id]/…): игрок вошёл, арт ему виден
// (чужой импортированный — 404). Проверка арта — лёгкая, без данных рисунка:
// на каждое автосохранение это лишний запрос к БД
export async function requireDrawingRequest(event: H3Event): Promise<{ user: SessionUser, artId: string }> {
  const user = await requireUser(event)
  const id = artIdParam(event)
  const [art] = await useDb()
    .select({ id: coloringArts.id })
    .from(coloringArts)
    .where(and(eq(coloringArts.id, id), visibleTo(user.id)))
    .limit(1)
  if (!art) throw artNotFound()
  return { user, artId: art.id }
}
