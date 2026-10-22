import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNull, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users } from '../../../../server/db/schema'
import { coloringArtCountries, coloringArtOpens, coloringArtUsers, coloringArts, coloringDrawings } from '../db/schema'
import {
  ADMIN_ARTS_PAGE_SIZE,
  adminArtApiPath,
  type AdminArt,
  type AdminArtDetails,
  type AdminArtPage,
  type ArtCounts,
  type ArtStatus,
  type ArtStatusFilter
} from '../../shared/admin'

export function artStatus(published: boolean, publishedAt: Date | null): ArtStatus {
  return published ? 'published' : publishedAt ? 'hidden' : 'draft'
}

export function adminArtImage(art: { id: string, imageUrl: string, hasSvg: boolean }): string {
  return art.hasSvg ? adminArtApiPath(art.id, '/image') : art.imageUrl
}

export function drawingArtParam(event: H3Event): string {
  return getRouterParam(event, 'artId') ?? ''
}

export const hasSvgField = sql<boolean>`${coloringArts.svg} is not null`

const artFields = {
  id: coloringArts.id,
  title: coloringArts.title,
  imageUrl: coloringArts.imageUrl,
  width: coloringArts.width,
  height: coloringArts.height,
  published: coloringArts.published,
  publishedAt: coloringArts.publishedAt,
  audience: coloringArts.audience,
  createdAt: coloringArts.createdAt,
  hasSvg: hasSvgField
}

const commonArt = isNull(coloringArts.ownerId)

function selectArts() {
  return useDb().select(artFields).from(coloringArts)
}

type ArtRow = Awaited<ReturnType<typeof selectArts>>[number]

export const EMPTY_COUNTS: Readonly<ArtCounts> = { openers: 0, started: 0, completed: 0 }

export interface CountsFilter {
  since: Date | null
  country: string | null
}

function countSince(column: AnyColumn, since: Date | null) {
  return since
    ? sql<number>`count(*) filter (where ${column} >= ${since.toISOString()}::timestamptz)`.mapWith(Number)
    : sql<number>`count(${column})`.mapWith(Number)
}

export async function countsByArt(filter: CountsFilter, artIds?: string[]): Promise<Map<string, ArtCounts>> {
  const db = useDb()
  const byCountry = filter.country ? eq(users.country, filter.country) : undefined
  const onlyArts = (column: AnyColumn): SQL | undefined => artIds ? inArray(column, artIds) : undefined

  const [opens, drawings] = await Promise.all([
    db.select({ artId: coloringArtOpens.artId, openers: countDistinct(coloringArtOpens.userId) })
      .from(coloringArtOpens)
      .innerJoin(users, eq(users.id, coloringArtOpens.userId))
      .where(and(filter.since ? gte(coloringArtOpens.openedAt, filter.since) : undefined, byCountry, onlyArts(coloringArtOpens.artId)))
      .groupBy(coloringArtOpens.artId),
    db.select({
      artId: coloringDrawings.artId,
      started: countSince(coloringDrawings.startedAt, filter.since),
      completed: countSince(coloringDrawings.completedAt, filter.since)
    })
      .from(coloringDrawings)
      .innerJoin(users, eq(users.id, coloringDrawings.userId))
      .where(and(byCountry, onlyArts(coloringDrawings.artId)))
      .groupBy(coloringDrawings.artId)
  ])

  const result = new Map<string, ArtCounts>()
  const entry = (artId: string): ArtCounts => {
    let counts = result.get(artId)
    if (!counts) {
      counts = { ...EMPTY_COUNTS }
      result.set(artId, counts)
    }
    return counts
  }
  for (const row of opens) entry(row.artId).openers = row.openers
  for (const row of drawings) Object.assign(entry(row.artId), { started: row.started, completed: row.completed })
  return result
}

export async function countOpeners(filter: CountsFilter): Promise<number> {
  const [row] = await useDb()
    .select({ total: countDistinct(coloringArtOpens.userId) })
    .from(coloringArtOpens)
    .innerJoin(users, eq(users.id, coloringArtOpens.userId))
    .innerJoin(coloringArts, and(eq(coloringArts.id, coloringArtOpens.artId), commonArt))
    .where(and(
      filter.since ? gte(coloringArtOpens.openedAt, filter.since) : undefined,
      filter.country ? eq(users.country, filter.country) : undefined
    ))
  return row?.total ?? 0
}

function toAdminArt(row: ArtRow, counts: ArtCounts | undefined, countryCount: number, playerCount: number): AdminArt {
  return {
    id: row.id,
    title: row.title,
    image: adminArtImage(row),
    width: row.width,
    height: row.height,
    status: artStatus(row.published, row.publishedAt),
    audience: row.audience,
    countryCount,
    playerCount,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    counts: counts ?? { ...EMPTY_COUNTS }
  }
}

const STATUS_WHERE: Record<ArtStatus, SQL> = {
  published: eq(coloringArts.published, true),
  hidden: sql`(not ${coloringArts.published} and ${coloringArts.publishedAt} is not null)`,
  draft: sql`(not ${coloringArts.published} and ${coloringArts.publishedAt} is null)`
}

async function countByStatus(): Promise<Record<ArtStatusFilter, number>> {
  const counted = (status: ArtStatus) => sql<number>`count(*) filter (where ${STATUS_WHERE[status]})`.mapWith(Number)
  const [row] = await useDb()
    .select({ all: count(), published: counted('published'), hidden: counted('hidden'), draft: counted('draft') })
    .from(coloringArts)
    .where(commonArt)
  return row ?? { all: 0, published: 0, hidden: 0, draft: 0 }
}

export async function listAdminArts(status: ArtStatusFilter, page: number): Promise<AdminArtPage> {
  const statusCounts = await countByStatus()
  const pageCount = Math.max(1, Math.ceil(statusCounts[status] / ADMIN_ARTS_PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = await selectArts()
    .where(and(commonArt, status === 'all' ? undefined : STATUS_WHERE[status]))
    .orderBy(asc(coloringArts.sortOrder), desc(coloringArts.createdAt), asc(coloringArts.id))
    .limit(ADMIN_ARTS_PAGE_SIZE)
    .offset((current - 1) * ADMIN_ARTS_PAGE_SIZE)
  if (!rows.length) return { items: [], page: current, pageCount, statusCounts }

  const ids = rows.map(row => row.id)
  const db = useDb()
  const [counts, countries, players] = await Promise.all([
    countsByArt({ since: null, country: null }, ids),
    db.select({ artId: coloringArtCountries.artId, total: count() }).from(coloringArtCountries)
      .where(inArray(coloringArtCountries.artId, ids)).groupBy(coloringArtCountries.artId),
    db.select({ artId: coloringArtUsers.artId, total: count() }).from(coloringArtUsers)
      .where(inArray(coloringArtUsers.artId, ids)).groupBy(coloringArtUsers.artId)
  ])
  const countryCounts = new Map(countries.map(row => [row.artId, row.total]))
  const playerCounts = new Map(players.map(row => [row.artId, row.total]))
  return {
    items: rows.map(row => toAdminArt(row, counts.get(row.id), countryCounts.get(row.id) ?? 0, playerCounts.get(row.id) ?? 0)),
    page: current,
    pageCount,
    statusCounts
  }
}

export async function requireAdminArt(id: string): Promise<ArtRow> {
  const [row] = await selectArts().where(and(eq(coloringArts.id, id), commonArt)).limit(1)
  if (!row) throw artNotFound()
  return row
}

export async function getAdminArt(id: string): Promise<AdminArtDetails> {
  const row = await requireAdminArt(id)
  const db = useDb()
  const [countries, players, counts] = await Promise.all([
    db.select({ country: coloringArtCountries.country }).from(coloringArtCountries)
      .where(eq(coloringArtCountries.artId, id)).orderBy(asc(coloringArtCountries.country)),
    db.select(adminPlayerFields)
      .from(coloringArtUsers)
      .innerJoin(users, eq(users.id, coloringArtUsers.userId))
      .where(eq(coloringArtUsers.artId, id))
      .orderBy(asc(users.usernameKey)),
    countsByArt({ since: null, country: null }, [id])
  ])
  return {
    ...toAdminArt(row, counts.get(id), countries.length, players.length),
    countries: countries.map(item => item.country),
    players: players.map(toAdminPlayer)
  }
}
