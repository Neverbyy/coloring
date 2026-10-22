export default defineAdminHandler(async (event) => {
  const image = await loadDrawingImage(userIdParam(event), drawingArtParam(event), 'base')
  return sendImage(event, image, 'png', 'private, no-store')
})
