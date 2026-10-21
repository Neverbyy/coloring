import { createHash } from 'node:crypto'
import { count, eq } from 'drizzle-orm'
import { IMPORT_MESSAGES, MAX_OWN_ARTS, MAX_SVG_BYTES, artApiPath, type ImportResult } from '../../../../shared/gallery'
import { coloringArts } from '../../../db/schema'

const MAX_TITLE = 40

// Название — из имени файла: «Мой кот.svg» → «Мой кот»
function titleFrom(name: unknown): string {
  const title = typeof name === 'string' ? name.replace(/\.svg$/i, '').replace(/[\p{Cc}\s]+/gu, ' ').trim() : ''
  return [...title].slice(0, MAX_TITLE).join('') || 'Мой рисунок'
}

// Импорт своего SVG: тело — сам файл, имя — в ?name=
export default defineEventHandler(async (event): Promise<ImportResult> => {
  const user = await requireUser(event)
  const body = await readLimitedBody(event, MAX_SVG_BYTES, IMPORT_MESSAGES.tooBig)
  if (!body) throw createError({ statusCode: 400, message: IMPORT_MESSAGES.empty })

  const db = useDb()
  const [own] = await db.select({ total: count() }).from(coloringArts).where(eq(coloringArts.ownerId, user.id))
  if ((own?.total ?? 0) >= MAX_OWN_ARTS) {
    throw createError({ statusCode: 409, message: `Можно загрузить до ${MAX_OWN_ARTS} рисунков — удали старые` })
  }

  const prepared = prepareSvgArt(new TextDecoder('utf-8', { fatal: false }).decode(body))
  const id = crypto.randomUUID()
  // Отпечаток подготовленного SVG: тот же рисунок под другим именем или с другим форматированием
  // даёт тот же результат. Повтор отсекает уникальный индекс (владелец + отпечаток) — и при двойном нажатии
  const svgHash = createHash('sha256').update(prepared.svg).digest('hex')
  const [row] = await db.insert(coloringArts).values({
    id,
    title: titleFrom(getQuery(event).name),
    imageUrl: artApiPath(id, '/image'),
    width: prepared.width,
    height: prepared.height,
    ownerId: user.id,
    svg: prepared.svg,
    svgHash
  }).onConflictDoNothing({ target: [coloringArts.ownerId, coloringArts.svgHash] }).returning()
  if (!row) throw createError({ statusCode: 409, message: 'Этот рисунок уже есть в твоей галерее' })

  return {
    art: toGalleryArt(row, { progress: null, thumbnailUpdatedAt: null, hasBase: null }),
    notes: prepared.notes
  }
})
