import { describe, expect, it } from 'vitest'
import { isPackedSnapshot, stickerBox } from '../layers/coloring/app/engine/engine'
import { paperGeometry, type StickerOp } from '../layers/coloring/shared/history'

describe('снимок рисунка со слоем стикеров', () => {
  it.each([
    ['квадратный арт', 1024, 1024],
    ['высокий арт', 300, 900],
    ['широкий арт', 2000, 1000]
  ])('%s: один слой — только краска, двойная высота — краска и стикеры', (_, artWidth, artHeight) => {
    const { width, height } = paperGeometry(artWidth, artHeight)
    expect(isPackedSnapshot(width, height, width, height)).toBe(false)
    expect(isPackedSnapshot(width, height * 2, width, height)).toBe(true)
    expect(isPackedSnapshot(width / 2, height, width, height)).toBe(true)
    expect(isPackedSnapshot(width / 2, height / 2, width, height)).toBe(false)
  })
})

describe('место стикера на бумаге', () => {
  const op = (size: number): StickerOp => ({ t: 'sticker', id: 'heart', p: [500, 300], size })

  it('длинная сторона картинки равна размеру, центр — в точке касания', () => {
    expect(stickerBox({ width: 512, height: 256 }, op(200))).toEqual({ x: 400, y: 250, w: 200, h: 100 })
    expect(stickerBox({ width: 340, height: 440 }, op(220))).toEqual({ x: 415, y: 190, w: 170, h: 220 })
  })

  it('размер не зависит от разрешения картинки', () => {
    expect(stickerBox({ width: 1000, height: 500 }, op(200))).toEqual(stickerBox({ width: 100, height: 50 }, op(200)))
  })
})
