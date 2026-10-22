import { parseHistorySave } from '#layers/coloring/shared/history'

export default defineEventHandler(async (event) => {
  const { user, artId } = await requireDrawingRequest(event)
  const save = parseHistorySave(await readBody(event))
  if (typeof save === 'string') throw createError({ statusCode: 400, message: save })
  return saveDrawingHistory(user.id, artId, save)
})
