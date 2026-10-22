import { ART_STATUS_FILTERS, type AdminArtPage, type ArtStatusFilter } from '#layers/coloring/shared/admin'

function isStatusFilter(value: unknown): value is ArtStatusFilter {
  return ART_STATUS_FILTERS.includes(value as ArtStatusFilter)
}

export default defineAdminHandler((event): Promise<AdminArtPage> => {
  const { status } = getQuery(event)
  return listAdminArts(isStatusFilter(status) ? status : 'all', pageQuery(event))
})
