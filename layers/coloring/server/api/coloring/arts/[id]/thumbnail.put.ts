import { MAX_THUMBNAIL_BYTES } from '#layers/coloring/shared/history'

export default defineEventHandler(async (event) => {
  const { user, artId } = await requireDrawingRequest(event)
  await saveDrawingThumbnail(user.id, artId, await readImageBody(event, 'jpeg', MAX_THUMBNAIL_BYTES))
  return { ok: true }
})
