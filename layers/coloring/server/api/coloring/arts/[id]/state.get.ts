import type { DrawingState } from '../../../../../shared/history'

export default defineEventHandler(async (event): Promise<DrawingState> => {
  const { user, artId } = await requireDrawingRequest(event)
  return loadDrawing(user.id, artId)
})
