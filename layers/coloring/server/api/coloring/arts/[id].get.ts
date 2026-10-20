import type { GalleryArt } from '../../../../shared/gallery'

export default defineEventHandler((event): GalleryArt => {
  const art = findGalleryArt(getRouterParam(event, 'id') ?? '')
  if (!art) throw createError({ statusCode: 404, statusMessage: 'Раскраска не найдена' })
  return art
})
