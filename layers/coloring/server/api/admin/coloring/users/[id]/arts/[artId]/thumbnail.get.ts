export default defineAdminHandler(async (event) => {
  const image = await loadDrawingImage(userIdParam(event), drawingArtParam(event), 'thumbnail')
  return sendImage(event, image, 'jpeg', IMMUTABLE_CACHE)
})
