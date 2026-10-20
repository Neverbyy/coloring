import { and, asc, count, eq } from 'drizzle-orm'
import { coloringArts, type ColoringArtRow } from '../db/schema'
import type { GalleryArt } from '../../shared/gallery'

const visible = eq(coloringArts.published, true)

// Прогресс и «свои» арты появятся вместе с пользователями
function toGalleryArt(row: ColoringArtRow): GalleryArt {
  return { id: row.id, title: row.title, image: row.imageUrl, progress: 0, own: false }
}

export async function countGalleryArts(): Promise<number> {
  const [row] = await useDb().select({ total: count() }).from(coloringArts).where(visible)
  return row?.total ?? 0
}

export async function listGalleryArts(offset: number, limit: number): Promise<GalleryArt[]> {
  const rows = await useDb()
    .select()
    .from(coloringArts)
    .where(visible)
    .orderBy(asc(coloringArts.sortOrder), asc(coloringArts.createdAt), asc(coloringArts.id))
    .limit(limit)
    .offset(offset)
  return rows.map(toGalleryArt)
}

export async function findGalleryArt(id: string): Promise<GalleryArt | undefined> {
  const [row] = await useDb()
    .select()
    .from(coloringArts)
    .where(and(eq(coloringArts.id, id), visible))
    .limit(1)
  return row && toGalleryArt(row)
}
