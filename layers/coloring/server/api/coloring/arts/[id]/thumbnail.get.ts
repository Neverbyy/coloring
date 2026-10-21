// Адрес содержит версию (?v=время изменения) — содержимое под ним не меняется
export default defineEventHandler(async (event) => {
  const { user, artId } = await requireDrawingRequest(event)
  return sendImage(event, await loadDrawingImage(user.id, artId, 'thumbnail'), 'jpeg', IMMUTABLE_CACHE)
})
