import { describe, expect, it } from 'vitest'
import { INITIAL_VIEW, ZOOM_MAX, ZOOM_MIN, clampView, nextZoomLevel, panBy, pinchView, zoomAt, type CanvasView } from '#layers/coloring/app/utils/zoom'

function screenPoint(view: CanvasView, contentX: number, contentY: number) {
  return { x: view.x + view.scale * contentX, y: view.y + view.scale * contentY }
}

describe('масштаб холста', () => {
  it('уровни идут по порядку и упираются в границы', () => {
    expect(nextZoomLevel(1, 1)).toBe(1.5)
    expect(nextZoomLevel(1.5, 1)).toBe(2.25)
    expect(nextZoomLevel(2.25, 1)).toBe(3)
    expect(nextZoomLevel(ZOOM_MAX, 1)).toBe(ZOOM_MAX)
    expect(nextZoomLevel(3, -1)).toBe(2.25)
    expect(nextZoomLevel(1.5, -1)).toBe(1)
    expect(nextZoomLevel(ZOOM_MIN, -1)).toBe(ZOOM_MIN)
  })

  it('приближение держит точку под пальцем на месте', () => {
    const point = { x: 0.2, y: -0.1 }
    const before = INITIAL_VIEW
    const after = zoomAt(before, 1, point.x, point.y)
    const contentX = (point.x - before.x) / before.scale
    const contentY = (point.y - before.y) / before.scale
    expect(after.scale).toBe(1.5)
    const moved = screenPoint(after, contentX, contentY)
    expect(moved.x).toBeCloseTo(point.x)
    expect(moved.y).toBeCloseTo(point.y)
  })

  it('на 1× сдвига нет, даже после отдаления из угла', () => {
    const zoomed = zoomAt(zoomAt(INITIAL_VIEW, 1, 0.5, 0.5), 1, 0.5, 0.5)
    const back = zoomAt(zoomAt(zoomed, -1, -0.4, 0.3), -1, -0.4, 0.3)
    expect(back.scale).toBe(1)
    expect(Math.abs(back.x)).toBe(0)
    expect(Math.abs(back.y)).toBe(0)
  })

  it('рисунок нельзя утащить из рамки', () => {
    const view = { scale: 2, x: 0, y: 0 }
    expect(panBy(view, 5, -5)).toEqual({ scale: 2, x: 0.5, y: -0.5 })
    expect(panBy(INITIAL_VIEW, 0.3, 0.3)).toEqual(INITIAL_VIEW)
    expect(clampView({ scale: 10, x: 9, y: -9 })).toEqual({ scale: ZOOM_MAX, x: 1, y: -1 })
  })

  it('щипок: точка между пальцами едет за пальцами, масштаб плавный в границах', () => {
    const start = { scale: 1.5, x: 0.1, y: -0.05 }
    const from = { x: 0.05, y: 0.1 }
    const to = { x: 0.12, y: 0.02 }
    const contentX = (from.x - start.x) / start.scale
    const contentY = (from.y - start.y) / start.scale
    const view = pinchView(start, 1.4, from.x, from.y, to.x, to.y)
    expect(view.scale).toBeCloseTo(2.1)
    const moved = screenPoint(view, contentX, contentY)
    expect(moved.x).toBeCloseTo(to.x)
    expect(moved.y).toBeCloseTo(to.y)
    expect(pinchView(start, 10, 0, 0, 0, 0).scale).toBe(ZOOM_MAX)
    expect(pinchView(start, 0.1, 0, 0, 0, 0)).toMatchObject({ scale: ZOOM_MIN })
  })

  it('приближение у края не выводит рисунок за рамку', () => {
    const view = zoomAt(INITIAL_VIEW, 1, 0.5, 0.5)
    expect(Math.abs(view.x)).toBeLessThanOrEqual((view.scale - 1) / 2)
    expect(Math.abs(view.y)).toBeLessThanOrEqual((view.scale - 1) / 2)
  })
})
