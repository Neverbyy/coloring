export interface CanvasView {
  scale: number
  x: number
  y: number
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3
export const INITIAL_VIEW: Readonly<CanvasView> = { scale: ZOOM_MIN, x: 0, y: 0 }

const WHEEL_ZOOM_SPEED = 0.002
const WHEEL_LINE_PX = 16
const WHEEL_PAGE_PX = 800
const TRACKPAD_PINCH_BOOST = 5
const WHEEL_SETTLE = 0.002

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clampView({ scale, x, y }: CanvasView): CanvasView {
  const next = clamp(scale, ZOOM_MIN, ZOOM_MAX)
  const limit = (next - 1) / 2
  return { scale: next, x: clamp(x, -limit, limit), y: clamp(y, -limit, limit) }
}

export function pinchView(start: CanvasView, ratio: number, fromX: number, fromY: number, toX: number, toY: number): CanvasView {
  const scale = clamp(start.scale * ratio, ZOOM_MIN, ZOOM_MAX)
  const contentX = (fromX - start.x) / start.scale
  const contentY = (fromY - start.y) / start.scale
  return clampView({ scale, x: toX - scale * contentX, y: toY - scale * contentY })
}

export function wheelDelta(deltaY: number, deltaMode: number, pinch: boolean): number {
  const pixels = deltaMode === 1 ? deltaY * WHEEL_LINE_PX : deltaMode === 2 ? deltaY * WHEEL_PAGE_PX : deltaY
  return pinch ? pixels * TRACKPAD_PINCH_BOOST : pixels
}

export function addWheelZoom(scale: number, pending: number, delta: number): number {
  const target = clamp(Math.log(scale) + pending - delta * WHEEL_ZOOM_SPEED, Math.log(ZOOM_MIN), Math.log(ZOOM_MAX))
  return target - Math.log(scale)
}

export function stepWheelZoom(view: CanvasView, pending: number, pointX: number, pointY: number, fraction: number): { view: CanvasView, pending: number } {
  const step = Math.abs(pending) <= WHEEL_SETTLE ? pending : pending * clamp(fraction, 0, 1)
  return { view: pinchView(view, Math.exp(step), pointX, pointY, pointX, pointY), pending: pending - step }
}
