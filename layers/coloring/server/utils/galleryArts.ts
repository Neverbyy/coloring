import { and, asc, count, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { coloringArts, coloringDrawings } from '../db/schema'
import type { H3Event } from 'h3'
import { artApiPath, type GalleryArt } from '../../shared/gallery'

// Какие арты видит игрок: опубликованные общие и свои импортированные.
// Единственное место правила — им пользуются и галерея, и обработчики рисунка
export function artNotFound() {
  return createError({ statusCode: 404, message: 'Раскраска не найдена' })
}

// id арта из адреса /api/coloring/arts/[id]/…
export function artIdParam(event: H3Event): string {
  return getRouterParam(event, 'id') ?? ''
}

export function visibleTo(userId: string) {
  return and(
    eq(coloringArts.published, true),
    or(isNull(coloringArts.ownerId), eq(coloringArts.ownerId, userId))
  )
}

// Поля арта для галереи — без SVG (он отдаётся отдельным адресом)
const artFields = {
  id: coloringArts.id,
  title: coloringArts.title,
  imageUrl: coloringArts.imageUrl,
  width: coloringArts.width,
  height: coloringArts.height,
  ownerId: coloringArts.ownerId
}

interface ArtSummary {
  id: string
  title: string
  imageUrl: string
  width: number
  height: number
  ownerId: string | null
}

// Только лёгкие поля рисунка — без картинок (о базе — лишь признак, есть ли она)
const drawingFields = {
  progress: coloringDrawings.progress,
  thumbnailUpdatedAt: coloringDrawings.thumbnailUpdatedAt,
  hasBase: sql<boolean>`${coloringDrawings.baseImage} is not null`
}

interface DrawingSummary {
  progress: number | null
  thumbnailUpdatedAt: Date | null
  hasBase: boolean | null
}

export function toGalleryArt(art: ArtSummary, drawing: DrawingSummary): GalleryArt {
  return {
    id: art.id,
    title: art.title,
    image: art.imageUrl,
    width: art.width,
    height: art.height,
    progress: drawing.progress ?? 0,
    // Версия в адресе: браузер кэширует миниатюру навсегда и скачивает заново только после изменений
    thumbnail: drawing.thumbnailUpdatedAt
      ? artApiPath(art.id, `/thumbnail?v=${drawing.thumbnailUpdatedAt.getTime()}`)
      : null,
    hasBase: drawing.hasBase === true,
    own: art.ownerId !== null
  }
}

// Рисунок к арту — только текущего игрока (для join)
function playerDrawing(userId: string) {
  return and(eq(coloringDrawings.artId, coloringArts.id), eq(coloringDrawings.userId, userId))
}

export async function countGalleryArts(userId: string): Promise<number> {
  const [row] = await useDb().select({ total: count() }).from(coloringArts).where(visibleTo(userId))
  return row?.total ?? 0
}

// Страница галереи и общее число артов одним запросом (count(*) over () — до limit/offset).
// Для пустой страницы (номер вне диапазона) total неизвестен — null.
// Порядок: сначала свои (новые первыми — импортированный арт сразу рядом с «+»), потом общие
export async function listGalleryArts(userId: string, offset: number, limit: number): Promise<{ items: GalleryArt[], total: number | null }> {
  const rows = await useDb()
    .select({ art: artFields, ...drawingFields, total: sql<number>`count(*) over ()`.mapWith(Number) })
    .from(coloringArts)
    .leftJoin(coloringDrawings, playerDrawing(userId))
    .where(visibleTo(userId))
    .orderBy(sql`${coloringArts.ownerId} is null`, asc(coloringArts.sortOrder), desc(coloringArts.createdAt), asc(coloringArts.id))
    .limit(limit)
    .offset(offset)
  return { items: rows.map(row => toGalleryArt(row.art, row)), total: rows[0]?.total ?? null }
}

export async function findGalleryArt(userId: string, id: string): Promise<GalleryArt | undefined> {
  const [row] = await useDb()
    .select({ art: artFields, ...drawingFields })
    .from(coloringArts)
    .leftJoin(coloringDrawings, playerDrawing(userId))
    .where(and(eq(coloringArts.id, id), visibleTo(userId)))
    .limit(1)
  return row && toGalleryArt(row.art, row)
}

// Для обработчиков рисунка: арт существует и виден игроку, иначе 404
export async function requireGalleryArt(userId: string, id: string): Promise<GalleryArt> {
  const art = await findGalleryArt(userId, id)
  if (!art) throw artNotFound()
  return art
}
