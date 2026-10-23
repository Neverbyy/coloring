import { and, asc, count, desc, eq, exists, isNull, or, sql } from 'drizzle-orm'
import { coloringArtCountries, coloringArtOpens, coloringArtUsers, coloringArts, coloringDrawings } from '#layers/coloring/server/db/schema'
import type { H3Event } from 'h3'
import { artApiPath, type GalleryArt } from '#layers/coloring/shared/gallery'

export function artNotFound() {
  return createError({ statusCode: 404, message: 'Раскраска не найдена' })
}

export function artIdParam(event: H3Event): string {
  return getRouterParam(event, 'id') ?? ''
}

export function visibleTo(user: SessionUser) {
  const db = useDb()
  return and(
    eq(coloringArts.published, true),
    or(
      eq(coloringArts.ownerId, user.id),
      and(
        isNull(coloringArts.ownerId),
        or(
          eq(coloringArts.audience, 'all'),
          exists(db.select({ one: sql`1` }).from(coloringArtCountries).where(and(
            eq(coloringArtCountries.artId, coloringArts.id),
            eq(coloringArtCountries.country, user.country)
          ))),
          exists(db.select({ one: sql`1` }).from(coloringArtUsers).where(and(
            eq(coloringArtUsers.artId, coloringArts.id),
            eq(coloringArtUsers.userId, user.id)
          )))
        )
      )
    )
  )
}

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

const drawingFields = {
  progress: coloringDrawings.progress,
  thumbnailUpdatedAt: coloringDrawings.thumbnailUpdatedAt,
  hasBase: sql<boolean>`${coloringDrawings.baseImage} is not null`
}

interface DrawingSummary {
  progress: number | null
  thumbnailUpdatedAt: Date | null
  hasBase: boolean | null
  isNew?: boolean | null
}

const NEW_ART_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

function isNewFor(userId: string) {
  const since = new Date(Date.now() - NEW_ART_DAYS * DAY_MS).toISOString()
  return sql<boolean>`(${coloringArts.ownerId} is null
    and ${coloringArts.publishedAt} > ${since}::timestamptz
    and ${coloringArts.publishedAt} > ${coloringArts.createdAt}
    and ${coloringDrawings.userId} is null
    and not exists (select 1 from ${coloringArtOpens}
      where ${coloringArtOpens.artId} = ${coloringArts.id} and ${coloringArtOpens.userId} = ${userId}))`
}

export function toGalleryArt(art: ArtSummary, drawing: DrawingSummary): GalleryArt {
  return {
    id: art.id,
    title: art.title,
    image: art.imageUrl,
    width: art.width,
    height: art.height,
    progress: drawing.progress ?? 0,
    thumbnail: drawing.thumbnailUpdatedAt
      ? artApiPath(art.id, `/thumbnail?v=${drawing.thumbnailUpdatedAt.getTime()}`)
      : null,
    hasBase: drawing.hasBase === true,
    own: art.ownerId !== null,
    isNew: drawing.isNew === true
  }
}

function playerDrawing(userId: string) {
  return and(eq(coloringDrawings.artId, coloringArts.id), eq(coloringDrawings.userId, userId))
}

export async function countGalleryArts(user: SessionUser): Promise<number> {
  const [row] = await useDb().select({ total: count() }).from(coloringArts).where(visibleTo(user))
  return row?.total ?? 0
}

export async function countCommonGalleryArts(user: SessionUser): Promise<number> {
  const [row] = await useDb().select({ total: count() }).from(coloringArts).where(and(visibleTo(user), isNull(coloringArts.ownerId)))
  return row?.total ?? 0
}

export async function listGalleryArts(user: SessionUser, offset: number, limit: number): Promise<{ items: GalleryArt[], total: number | null }> {
  const rows = await useDb()
    .select({ art: artFields, ...drawingFields, isNew: isNewFor(user.id), total: sql<number>`count(*) over ()`.mapWith(Number) })
    .from(coloringArts)
    .leftJoin(coloringDrawings, playerDrawing(user.id))
    .where(visibleTo(user))
    .orderBy(
      sql`${coloringArts.ownerId} is not null`,
      sql`${coloringArts.publishedAt} desc nulls last`,
      asc(coloringArts.sortOrder),
      desc(coloringArts.createdAt),
      asc(coloringArts.id)
    )
    .limit(limit)
    .offset(offset)
  return { items: rows.map(row => toGalleryArt(row.art, row)), total: rows[0]?.total ?? null }
}

export async function findGalleryArt(user: SessionUser, id: string): Promise<GalleryArt | undefined> {
  const [row] = await useDb()
    .select({ art: artFields, ...drawingFields, isNew: isNewFor(user.id) })
    .from(coloringArts)
    .leftJoin(coloringDrawings, playerDrawing(user.id))
    .where(and(eq(coloringArts.id, id), visibleTo(user)))
    .limit(1)
  return row && toGalleryArt(row.art, row)
}

export async function requireGalleryArt(user: SessionUser, id: string): Promise<GalleryArt> {
  const art = await findGalleryArt(user, id)
  if (!art) throw artNotFound()
  return art
}
