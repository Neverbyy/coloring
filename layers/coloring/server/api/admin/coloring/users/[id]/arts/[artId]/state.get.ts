import type { DrawingState } from '#layers/coloring/shared/history'

export default defineAdminHandler((event): Promise<DrawingState> => loadDrawing(userIdParam(event), drawingArtParam(event)))
