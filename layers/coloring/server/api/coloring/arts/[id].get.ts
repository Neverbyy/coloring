import type { GalleryArt } from '../../../../shared/gallery'

export default defineEventHandler(async (event): Promise<GalleryArt> => {
  const user = await requireUser(event)
  return requireGalleryArt(user.id, artIdParam(event))
})
