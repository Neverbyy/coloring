export interface CanvasView {
  scale: number
  x: number
  y: number
}

export const ZOOM_LEVELS: readonly number[] = [1, 1.5, 2.25, 3]
export const ZOOM_MIN = 1
export const ZOOM_MAX = 3
export const INITIAL_VIEW: Readonly<CanvasView> = { scale: ZOOM_MIN, x: 0, y: 0 }

const EPSILON = 1e-6

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampView({ scale, x, y }: CanvasView): CanvasView {
  const next = clamp(scale, ZOOM_MIN, ZOOM_MAX)
  const limit = (next - 1) / 2
  return { scale: next, x: clamp(x, -limit, limit), y: clamp(y, -limit, limit) }
}

export function nextZoomLevel(scale: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_LEVELS.find(level => level > scale + EPSILON) ?? ZOOM_MAX
  return ZOOM_LEVELS.findLast(level => level < scale - EPSILON) ?? ZOOM_MIN
}

export function zoomAt(view: CanvasView, direction: 1 | -1, pointX: number, pointY: number): CanvasView {
  const scale = nextZoomLevel(view.scale, direction)
  const ratio = scale / view.scale
  return clampView({
    scale,
    x: pointX - (pointX - view.x) * ratio,
    y: pointY - (pointY - view.y) * ratio
  })
}

export function panBy(view: CanvasView, dx: number, dy: number): CanvasView {
  return clampView({ scale: view.scale, x: view.x + dx, y: view.y + dy })
}

export function pinchView(start: CanvasView, ratio: number, fromX: number, fromY: number, toX: number, toY: number): CanvasView {
  const scale = clamp(start.scale * ratio, ZOOM_MIN, ZOOM_MAX)
  const contentX = (fromX - start.x) / start.scale
  const contentY = (fromY - start.y) / start.scale
  return clampView({ scale, x: toX - scale * contentX, y: toY - scale * contentY })
}
