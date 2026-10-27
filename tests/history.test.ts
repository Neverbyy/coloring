import { describe, expect, it } from 'vitest'
import {
  STROKE_OPACITY_RANGE,
  STROKE_WIDTH_RANGES,
  MAX_COORD,
  MAX_STORED_OPS,
  MAX_STROKE_POINTS,
  PAPER_MAX_ASPECT,
  PAPER_MIN_ASPECT,
  WORK_SIZE,
  paperGeometry,
  parseHistoryOp,
  parseHistorySave
} from '../layers/coloring/shared/history'
import { PALETTE } from '../layers/coloring/shared/palette'

const COLOR = PALETTE[0]!.hex

describe('проверка операций истории с клиента', () => {
  it('штрих принимается и очищается от лишних полей', () => {
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2, 3, 4], extra: '<script>' }))
      .toEqual({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2, 3, 4] })
  })

  it('у резинки цвета нет, даже если клиент его прислал', () => {
    expect(parseHistoryOp({ t: 'stroke', tool: 'eraser', c: COLOR, p: [5, 5] }))
      .toEqual({ t: 'stroke', tool: 'eraser', c: null, p: [5, 5] })
  })

  it.each([
    ['чужой инструмент', { t: 'stroke', tool: 'spray', c: COLOR, p: [1, 1] }],
    ['цвет не из палитры', { t: 'stroke', tool: 'brush', c: '#123456', p: [1, 1] }],
    ['нечётное число координат', { t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2, 3] }],
    ['пустой штрих', { t: 'stroke', tool: 'brush', c: COLOR, p: [] }],
    ['координата за бумагой', { t: 'stroke', tool: 'brush', c: COLOR, p: [MAX_COORD + 1, 0] }],
    ['отрицательная координата', { t: 'stroke', tool: 'brush', c: COLOR, p: [-1, 0] }],
    ['дробная координата', { t: 'stroke', tool: 'brush', c: COLOR, p: [1.5, 0] }],
    ['слишком длинный штрих', { t: 'stroke', tool: 'brush', c: COLOR, p: Array(MAX_STROKE_POINTS * 2 + 2).fill(1) }],
    ['заливка резинкой', { t: 'fill', tool: 'eraser', c: COLOR, p: [1, 1] }],
    ['заливка без точки', { t: 'fill', c: COLOR }],
    ['неизвестная операция', { t: 'drop', p: [1, 1] }],
    ['не объект', 'stroke'],
    ['null', null]
  ])('отклоняется: %s', (_, op) => {
    expect(parseHistoryOp(op)).toBeNull()
  })

  it('заливка без инструмента — кисть (старая история)', () => {
    expect(parseHistoryOp({ t: 'fill', c: COLOR, p: [10, 20] })).toEqual({ t: 'fill', tool: 'brush', c: COLOR, p: [10, 20] })
    expect(parseHistoryOp({ t: 'fill', tool: 'pencil', c: COLOR, p: [10, 20] })).toEqual({ t: 'fill', tool: 'pencil', c: COLOR, p: [10, 20] })
  })

  it('очистка сегмента', () => {
    expect(parseHistoryOp({ t: 'clear', p: [7, 8], c: COLOR })).toEqual({ t: 'clear', p: [7, 8] })
  })

  it('толщина и прозрачность штриха — в диапазоне инструмента', () => {
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], w: 60, a: 0.3 }))
      .toEqual({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], w: 60, a: 0.3 })
    expect(parseHistoryOp({ t: 'stroke', tool: 'pencil', c: COLOR, p: [1, 2], w: 6, a: 0.6 }))
      .toEqual({ t: 'stroke', tool: 'pencil', c: COLOR, p: [1, 2], w: 6, a: 0.6 })
    const { brush, pencil } = STROKE_WIDTH_RANGES
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], w: brush.min, a: STROKE_OPACITY_RANGE.min }))
      .toMatchObject({ w: brush.min, a: STROKE_OPACITY_RANGE.min })
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], w: 47, a: 0.35 })).toMatchObject({ w: 47, a: 0.35 })
    expect(parseHistoryOp({ t: 'stroke', tool: 'pencil', c: COLOR, p: [1, 2], w: pencil.max + 1 })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], w: brush.min - 1 })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], w: 34.5 })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], w: Number.NaN })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], a: 0 })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], a: 0.05 })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], a: 1.01 })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], a: 0.333 })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], a: '1' })).toBeNull()
  })

  it('прозрачность из ползунка с погрешностью дробей принимается и округляется', () => {
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2], a: 1 - 0.65 })).toMatchObject({ a: 0.35 })
    expect(parseHistoryOp({ t: 'fill', tool: 'pencil', c: COLOR, p: [1, 2], a: 0.1 + 0.2 })).toMatchObject({ a: 0.3 })
  })

  it('у резинки толщины и прозрачности нет', () => {
    expect(parseHistoryOp({ t: 'stroke', tool: 'eraser', c: null, p: [1, 2], w: 60, a: 0.3 }))
      .toEqual({ t: 'stroke', tool: 'eraser', c: null, p: [1, 2] })
  })

  it('заливка с прозрачностью; без полей — как раньше', () => {
    expect(parseHistoryOp({ t: 'fill', tool: 'brush', c: COLOR, p: [1, 2], a: 0.6 }))
      .toEqual({ t: 'fill', tool: 'brush', c: COLOR, p: [1, 2], a: 0.6 })
    expect(parseHistoryOp({ t: 'fill', tool: 'brush', c: COLOR, p: [1, 2], a: 0.5 })).toMatchObject({ a: 0.5 })
    expect(parseHistoryOp({ t: 'fill', tool: 'brush', c: COLOR, p: [1, 2], a: 0.01 })).toBeNull()
    expect(parseHistoryOp({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2] }))
      .toEqual({ t: 'stroke', tool: 'brush', c: COLOR, p: [1, 2] })
  })

  it('сброс всего рисунка — без лишних полей', () => {
    expect(parseHistoryOp({ t: 'reset', p: [1, 2], c: COLOR, extra: '<script>' })).toEqual({ t: 'reset' })
  })
})

describe('проверка сохранения истории', () => {
  const op = { t: 'clear', p: [1, 1] }

  it('корректное сохранение', () => {
    expect(parseHistorySave({ fromSeq: 3, ops: [op], cursor: 4, progress: 12.5 }))
      .toEqual({ fromSeq: 3, ops: [op], cursor: 4, progress: 12.5 })
  })

  it('сброс сохраняется вместе с другими операциями', () => {
    expect(parseHistorySave({ fromSeq: 0, ops: [op, { t: 'reset' }], cursor: 2, progress: 0 }))
      .toEqual({ fromSeq: 0, ops: [op, { t: 'reset' }], cursor: 2, progress: 0 })
  })

  it.each([
    ['отрицательная позиция', { fromSeq: -1, ops: [], cursor: 0, progress: 0 }],
    ['позиция не целая', { fromSeq: 1.5, ops: [], cursor: 0, progress: 0 }],
    ['операции не массив', { fromSeq: 0, ops: 'x', cursor: 0, progress: 0 }],
    ['слишком много операций', { fromSeq: 0, ops: Array(MAX_STORED_OPS + 1).fill(op), cursor: 0, progress: 0 }],
    ['плохая операция внутри', { fromSeq: 0, ops: [op, { t: 'stroke' }], cursor: 0, progress: 0 }],
    ['процент больше 100', { fromSeq: 0, ops: [], cursor: 0, progress: 101 }],
    ['процент не число', { fromSeq: 0, ops: [], cursor: 0, progress: Number.NaN }],
    ['пустое тело', null]
  ])('отклоняется: %s', (_, body) => {
    expect(typeof parseHistorySave(body)).toBe('string')
  })
})

describe('бумага рисунка', () => {
  it.each([
    [1024, 1024],
    [462, 460],
    [2000, 1000],
    [300, 900]
  ])('арт %ix%i: длинная сторона — WORK_SIZE, картинка по центру, рамки любой формы покрыты', (w, h) => {
    const paper = paperGeometry(w, h)
    expect(Math.max(paper.art.width, paper.art.height)).toBe(WORK_SIZE)
    expect(Math.abs(paper.art.x * 2 + paper.art.width - paper.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(paper.art.y * 2 + paper.art.height - paper.height)).toBeLessThanOrEqual(1)
    expect(paper.width).toBeGreaterThanOrEqual(Math.ceil(paper.art.height * PAPER_MAX_ASPECT))
    expect(paper.height).toBeGreaterThanOrEqual(Math.ceil(paper.art.width / PAPER_MIN_ASPECT))
    expect(Math.max(paper.width, paper.height)).toBeLessThanOrEqual(MAX_COORD)
  })

  it('зависит только от пропорций арта — одинакова на любом устройстве', () => {
    expect(paperGeometry(740, 740)).toEqual(paperGeometry(1024, 1024))
    expect(paperGeometry(400, 200)).toEqual(paperGeometry(400, 200))
  })
})
