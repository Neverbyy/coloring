import { and, asc, count, eq, sql } from 'drizzle-orm'
import { coloringArts, coloringDrawings, type ColoringArtRow } from '../db/schema'
import type { GalleryArt } from '../../shared/gallery'

const visible = eq(coloringArts.published, true)

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

// «Свои» (импортированные) арты появятся вместе с импортом
function toGalleryArt(row: ColoringArtRow, drawing: DrawingSummary): GalleryArt {
  return {
    id: row.id,
    title: row.title,
    image: row.imageUrl,
    width: row.width,
    height: row.height,
    progress: drawing.progress ?? 0,
    // Версия в адресе: браузер кэширует миниатюру навсегда и скачивает заново только после изменений
    thumbnail: drawing.thumbnailUpdatedAt
      ? `/api/coloring/arts/${encodeURIComponent(row.id)}/thumbnail?v=${drawing.thumbnailUpdatedAt.getTime()}`
      : null,
    hasBase: drawing.hasBase === true,
    own: false
  }
}

// Рисунок — только текущего игрока
function drawingOf(userId: string) {
  return and(eq(coloringDrawings.artId, coloringArts.id), eq(coloringDrawings.userId, userId))
}

export async function countGalleryArts(): Promise<number> {
  const [row] = await useDb().select({ total: count() }).from(coloringArts).where(visible)
  return row?.total ?? 0
}

// Страница галереи и общее число артов одним запросом (count(*) over () — до limit/offset).
// Для пустой страницы (номер вне диапазона) total неизвестен — null
export async function listGalleryArts(userId: string, offset: number, limit: number): Promise<{ items: GalleryArt[], total: number | null }> {
  const rows = await useDb()
    .select({ art: coloringArts, ...drawingFields, total: sql<number>`count(*) over ()`.mapWith(Number) })
    .from(coloringArts)
    .leftJoin(coloringDrawings, drawingOf(userId))
    .where(visible)
    .orderBy(asc(coloringArts.sortOrder), asc(coloringArts.createdAt), asc(coloringArts.id))
    .limit(limit)
    .offset(offset)
  return { items: rows.map(row => toGalleryArt(row.art, row)), total: rows[0]?.total ?? null }
}

export async function findGalleryArt(userId: string, id: string): Promise<GalleryArt | undefined> {
  const [row] = await useDb()
    .select({ art: coloringArts, ...drawingFields })
    .from(coloringArts)
    .leftJoin(coloringDrawings, drawingOf(userId))
    .where(and(eq(coloringArts.id, id), visible))
    .limit(1)
  return row && toGalleryArt(row.art, row)
}

// Для обработчиков рисунка: арт существует и опубликован, иначе 404
export async function requireGalleryArt(userId: string, id: string): Promise<GalleryArt> {
  const art = await findGalleryArt(userId, id)
  if (!art) throw createError({ statusCode: 404, message: 'Раскраска не найдена' })
  return art
}
