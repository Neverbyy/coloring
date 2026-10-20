export default defineEventHandler(async (event) => {
  const { user, artId } = await requireDrawingRequest(event)
  return sendImage(event, await loadDrawingImage(user.id, artId, 'base'), 'png', 'private, no-store')
})
