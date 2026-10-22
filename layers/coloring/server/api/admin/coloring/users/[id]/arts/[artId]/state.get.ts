import type { DrawingState } from '../../../../../../../../shared/history'

export default defineAdminHandler((event): Promise<DrawingState> => loadDrawing(userIdParam(event), drawingArtParam(event)))
