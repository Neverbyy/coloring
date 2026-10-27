import { describe, expect, it } from 'vitest'
import { INITIAL_VIEW, ZOOM_MAX, ZOOM_MIN, addWheelZoom, clampView, pinchView, stepWheelZoom, wheelDelta, type CanvasView } from '#layers/coloring/app/utils/zoom'

function screenPoint(view: CanvasView, contentX: number, contentY: number) {
  return { x: view.x + view.scale * contentX, y: view.y + view.scale * contentY }
}

function contentAt(view: CanvasView, x: number, y: number) {
  return { x: (x - view.x) / view.scale, y: (y - view.y) / view.scale }
}

function wheel(view: CanvasView, delta: number, x: number, y: number): CanvasView {
  return stepWheelZoom(view, addWheelZoom(view.scale, 0, delta), x, y, 1).view
}

describe('масштаб холста', () => {
  it('рисунок нельзя утащить из рамки', () => {
    expect(clampView({ scale: 2, x: 5, y: -5 })).toEqual({ scale: 2, x: 0.5, y: -0.5 })
    expect(clampView({ scale: 1, x: 0.3, y: 0.3 })).toEqual(INITIAL_VIEW)
    expect(clampView({ scale: 10, x: 9, y: -9 })).toEqual({ scale: ZOOM_MAX, x: 1, y: -1 })
  })

  it('щипок: точка между пальцами едет за пальцами, масштаб плавный в границах', () => {
    const start = { scale: 1.5, x: 0.1, y: -0.05 }
    const from = { x: 0.05, y: 0.1 }
    const to = { x: 0.12, y: 0.02 }
    const content = contentAt(start, from.x, from.y)
    const view = pinchView(start, 1.4, from.x, from.y, to.x, to.y)
    expect(view.scale).toBeCloseTo(2.1)
    const moved = screenPoint(view, content.x, content.y)
    expect(moved.x).toBeCloseTo(to.x)
    expect(moved.y).toBeCloseTo(to.y)
    expect(pinchView(start, 10, 0, 0, 0, 0).scale).toBe(ZOOM_MAX)
    expect(pinchView(start, 0.1, 0, 0, 0, 0)).toMatchObject({ scale: ZOOM_MIN })
  })

  it('колесо вверх приближает, и точка под курсором остаётся на месте', () => {
    const point = { x: 0.2, y: -0.1 }
    const content = contentAt(INITIAL_VIEW, point.x, point.y)
    const view = wheel(INITIAL_VIEW, -100, point.x, point.y)
    expect(view.scale).toBeGreaterThan(1.2)
    expect(view.scale).toBeLessThan(1.25)
    const moved = screenPoint(view, content.x, content.y)
    expect(moved.x).toBeCloseTo(point.x)
    expect(moved.y).toBeCloseTo(point.y)
  })

  it('плавное приближение: на каждом промежуточном кадре точка под курсором стоит на месте', () => {
    const point = { x: -0.15, y: 0.25 }
    let view: CanvasView = { scale: 1.3, x: 0.05, y: -0.05 }
    const content = contentAt(view, point.x, point.y)
    let pending = addWheelZoom(view.scale, 0, -300)
    for (let frame = 0; frame < 8; frame++) {
      ;({ view, pending } = stepWheelZoom(view, pending, point.x, point.y, 0.3))
      const moved = screenPoint(view, content.x, content.y)
      expect(moved.x).toBeCloseTo(point.x)
      expect(moved.y).toBeCloseTo(point.y)
    }
  })

  it('анимация доходит до конца и останавливается', () => {
    let view: CanvasView = INITIAL_VIEW
    let pending = addWheelZoom(view.scale, 0, -200)
    let frames = 0
    while (pending !== 0 && frames < 200) {
      ;({ view, pending } = stepWheelZoom(view, pending, 0, 0, 0.2))
      frames++
    }
    expect(pending).toBe(0)
    expect(frames).toBeLessThan(40)
    expect(view.scale).toBeCloseTo(Math.exp(0.4))
  })

  it('колесо вниз отдаляет, ниже 1× и выше 3× не уходит', () => {
    const zoomed = { scale: 2, x: 0.3, y: -0.2 }
    expect(wheel(zoomed, 100, 0, 0).scale).toBeLessThan(2)
    expect(wheel(zoomed, 100_000, 0.4, 0.4)).toEqual(INITIAL_VIEW)
    expect(wheel(zoomed, -100_000, 0, 0).scale).toBeCloseTo(ZOOM_MAX)
  })

  it('прокрутка дальше 3× не копится: обратная прокрутка сразу отдаляет', () => {
    expect(addWheelZoom(ZOOM_MAX, 0, -5000)).toBeCloseTo(0)
    const pending = addWheelZoom(ZOOM_MAX, addWheelZoom(ZOOM_MAX, 0, -5000), 100)
    expect(pending).toBeLessThan(0)
    expect(addWheelZoom(2, 0, -5000)).toBeCloseTo(Math.log(ZOOM_MAX / 2))
  })

  it('обратная прокрутка возвращает тот же масштаб', () => {
    const start = { scale: 1.8, x: 0.1, y: 0.05 }
    const back = wheel(wheel(start, -240, 0.1, 0.1), 240, 0.1, 0.1)
    expect(back.scale).toBeCloseTo(start.scale)
    expect(back.x).toBeCloseTo(start.x)
    expect(back.y).toBeCloseTo(start.y)
  })

  it('прокрутка строками (Firefox) и страницами приводится к пикселям, щипок тачпада сильнее', () => {
    expect(wheelDelta(100, 0, false)).toBe(100)
    expect(wheelDelta(3, 1, false)).toBe(48)
    expect(wheelDelta(1, 2, false)).toBe(800)
    expect(wheelDelta(-4, 0, true)).toBe(-20)
  })

  it('приближение у края не выводит рисунок за рамку', () => {
    const view = wheel(INITIAL_VIEW, -300, 0.5, 0.5)
    expect(Math.abs(view.x)).toBeLessThanOrEqual((view.scale - 1) / 2 + 1e-9)
    expect(Math.abs(view.y)).toBeLessThanOrEqual((view.scale - 1) / 2 + 1e-9)
  })
})
