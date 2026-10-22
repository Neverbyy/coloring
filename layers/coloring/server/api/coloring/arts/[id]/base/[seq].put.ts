import { MAX_IMAGE_BYTES } from '#layers/coloring/shared/history'

export default defineEventHandler(async (event) => {
  const { user, artId } = await requireDrawingRequest(event)
  const seq = Number(getRouterParam(event, 'seq'))
  if (!Number.isInteger(seq) || seq < 0) throw createError({ statusCode: 400, message: 'Неверный номер операции' })

  const image = seq === 0 ? null : await readImageBody(event, 'png', MAX_IMAGE_BYTES)
  return saveDrawingBase(user.id, artId, seq, image)
})
