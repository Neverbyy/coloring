import { MAX_IMAGE_BYTES } from '../../../../../../shared/history'

// Базовое изображение рисунка: всё до операции seq. seq = 0 с пустым телом — чистый холст
export default defineEventHandler(async (event) => {
  const { user, artId } = await requireDrawingRequest(event)
  const seq = Number(getRouterParam(event, 'seq'))
  if (!Number.isInteger(seq) || seq < 0) throw createError({ statusCode: 400, message: 'Неверный номер операции' })

  const image = seq === 0 ? null : await readImageBody(event, 'png', MAX_IMAGE_BYTES)
  return saveDrawingBase(user.id, artId, seq, image)
})
