import type { GalleryArt } from '#layers/coloring/shared/gallery'

export default defineEventHandler(async (event): Promise<GalleryArt> => {
  const user = await requireUser(event)
  return requireGalleryArt(user, artIdParam(event))
})
