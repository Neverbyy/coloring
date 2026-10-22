import type { AdminPlayer } from '#shared/types/admin'

export const ADMIN_ARTS_API = '/api/admin/coloring/arts'

export function adminArtApiPath(id: string, path = ''): string {
  return `${ADMIN_ARTS_API}/${encodeURIComponent(id)}${path}`
}

export function adminDrawingApiPath(userId: string, artId: string, path = ''): string {
  return `/api/admin/coloring/users/${encodeURIComponent(userId)}/arts/${encodeURIComponent(artId)}${path}`
}

export type ArtStatus = 'draft' | 'published' | 'hidden'
export type ArtAudience = 'all' | 'assigned'

export interface ArtCounts {
  openers: number
  started: number
  completed: number
}

export interface AdminArt {
  id: string
  title: string
  image: string
  width: number
  height: number
  status: ArtStatus
  audience: ArtAudience
  countryCount: number
  playerCount: number
  createdAt: string
  publishedAt: string | null
  counts: ArtCounts
}

export const ADMIN_ARTS_PAGE_SIZE = 24
export const ART_STATUS_FILTERS = ['all', 'published', 'hidden', 'draft'] as const
export type ArtStatusFilter = typeof ART_STATUS_FILTERS[number]

export interface AdminArtPage {
  items: AdminArt[]
  page: number
  pageCount: number
  statusCounts: Record<ArtStatusFilter, number>
}

export interface AdminArtDetails extends AdminArt {
  countries: string[]
  players: AdminPlayer[]
}

export interface AdminArtUpload {
  id: string
  notes: string[]
}

export interface AdminArtPatch {
  title?: string
  published?: boolean
}

export interface AudienceUpdate {
  audience: ArtAudience
  countries: string[]
  userIds: string[]
}

export const STATS_PERIODS = ['7', '30', 'all'] as const
export type StatsPeriod = typeof STATS_PERIODS[number]

export interface ArtStatsRow extends ArtCounts {
  id: string
  title: string
  image: string
  status: ArtStatus
}

export interface ColoringStats {
  totals: ArtCounts
  items: ArtStatsRow[]
}

export interface AdminDrawing {
  art: {
    id: string
    title: string
    image: string
    width: number
    height: number
    own: boolean
    status: ArtStatus
  }
  drawn: boolean
  progress: number
  thumbnail: string | null
  lastOpenedAt: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
}
