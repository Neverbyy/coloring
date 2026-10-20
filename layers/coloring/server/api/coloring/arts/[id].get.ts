import type { GalleryArt } from '../../../../shared/gallery'

export default defineEventHandler(async (event): Promise<GalleryArt> => {
  await requireUser(event)
  const art = await findGalleryArt(getRouterParam(event, 'id') ?? '')
  if (!art) throw createError({ statusCode: 404, message: 'Раскраска не найдена' })
  return art
})
