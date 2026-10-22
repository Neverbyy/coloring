import { describe, expect, it } from 'vitest'
import { buildSegmentMap, type SegmentMap } from '../layers/coloring/app/engine/segmentation'

const SIZE = 200
const LINE = 3

function canvas(size = SIZE) {
  const rgba = new Uint8ClampedArray(size * size * 4).fill(255)
  const ink = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    rgba.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3)
  }
  const square = (left: number, top: number, side: number, gap?: { at: number, width: number }) => {
    for (let t = 0; t < LINE; t++) {
      for (let i = 0; i < side; i++) {
        const inGap = gap && i >= gap.at && i < gap.at + gap.width
        ink(left + i, top + t)
        ink(left + i, top + side - 1 - t)
        ink(left + t, top + i)
        if (!inGap) ink(left + side - 1 - t, top + i)
      }
    }
  }
  return { rgba, square, ink, map: (): SegmentMap => buildSegmentMap(rgba, size, size) }
}

const areas = (map: SegmentMap) => map.segments.filter(segment => !segment.background)
const at = (map: SegmentMap, x: number, y: number) => map.labels[y * map.width + x]!

describe('разметка областей', () => {
  it('замкнутый контур — отдельная область, всё у края — фон', () => {
    const image = canvas()
    image.square(50, 50, 100)
    const map = image.map()
    const inner = areas(map)
    expect(inner).toHaveLength(1)
    expect(at(map, 100, 100)).toBe(inner[0]!.id)
    expect(map.segments[at(map, 5, 5)]!.background).toBe(true)
    expect(at(map, 51, 100)).toBe(-1)
    expect(inner[0]!.area).toBeGreaterThan(90 * 90)
    expect(inner[0]!.area).toBeLessThan(100 * 100)
  })

  it('две фигуры — две области', () => {
    const image = canvas()
    image.square(20, 20, 70)
    image.square(110, 110, 70)
    const map = image.map()
    expect(areas(map)).toHaveLength(2)
    expect(at(map, 55, 55)).not.toBe(at(map, 145, 145))
  })

  it('разрыв в линии в 4 пикселя закрывается — область не сливается с фоном', () => {
    const image = canvas()
    image.square(50, 50, 100, { at: 48, width: 4 })
    const map = image.map()
    expect(areas(map)).toHaveLength(1)
    expect(map.segments[at(map, 100, 100)]!.background).toBe(false)
  })

  it('широкий разрыв не закрывается: область сливается с фоном', () => {
    const image = canvas()
    image.square(50, 50, 100, { at: 30, width: 30 })
    const map = image.map()
    expect(areas(map)).toHaveLength(0)
    expect(map.segments[at(map, 100, 100)]!.background).toBe(true)
  })

  it('крошечная замкнутая клетка — мусор, а не область для раскраски', () => {
    const image = canvas()
    image.square(50, 50, 100)
    image.square(10, 160, 9)
    const map = image.map()
    expect(areas(map)).toHaveLength(1)
  })

  it('краска заходит под линию с той стороны, к которой точка линии ближе', () => {
    const image = canvas()
    image.square(50, 50, 100)
    const map = image.map()
    const inner = areas(map)[0]!
    expect(map.paint[100 * map.width + 52]).toBe(inner.id)
    expect(map.segments[map.paint[100 * map.width + 50]!]!.background).toBe(true)
  })

  it('одинаковая картинка — одинаковая разметка', () => {
    const first = canvas()
    first.square(30, 30, 120)
    const second = canvas()
    second.square(30, 30, 120)
    expect(Array.from(first.map().labels)).toEqual(Array.from(second.map().labels))
  })
})
