import { PALETTE } from './palette'

export const WORK_SIZE = 1024
export const PAPER_MAX_ASPECT = 1.6
export const PAPER_MIN_ASPECT = 0.4
export const MAX_COORD = Math.ceil(WORK_SIZE / PAPER_MIN_ASPECT)
export const HISTORY_LIMIT = 50
export const BAKE_CHUNK = 20
export const SNAPSHOT_INTERVAL = 20
export const MAX_STORED_OPS = 300
export const MAX_STROKE_POINTS = 5000
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
export const MAX_THUMBNAIL_BYTES = 512 * 1024

export type StrokeTool = 'brush' | 'pencil' | 'eraser'
export type PaintTool = Exclude<StrokeTool, 'eraser'>

export interface StrokeRange {
  min: number
  max: number
  initial: number
}

export const STROKE_WIDTH_RANGES: Record<PaintTool, StrokeRange> = {
  brush: { min: 8, max: 80, initial: 34 },
  pencil: { min: 3, max: 30, initial: 12 }
}
export const STROKE_OPACITY_RANGE: StrokeRange = { min: 0.1, max: 1, initial: 1 }

export const STICKERS = ['heart', 'star', 'flower', 'butterfly', 'ladybug', 'rainbow'] as const
export type StickerId = typeof STICKERS[number]
export const STICKER_SIZE_RANGE: StrokeRange = { min: 64, max: 448, initial: 192 }

function integerInRange({ min, max }: StrokeRange, value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? value as number : null
}

export function parseStrokeWidth(tool: PaintTool, value: unknown): number | null {
  return integerInRange(STROKE_WIDTH_RANGES[tool], value)
}

export function parseStickerSize(value: unknown): number | null {
  return integerInRange(STICKER_SIZE_RANGE, value)
}

export function isStickerId(value: unknown): value is StickerId {
  return typeof value === 'string' && (STICKERS as readonly string[]).includes(value)
}

export function parseStrokeOpacity(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const percent = Math.round(value * 100)
  if (Math.abs(value * 100 - percent) > 1e-6) return null
  const opacity = percent / 100
  return opacity >= STROKE_OPACITY_RANGE.min && opacity <= STROKE_OPACITY_RANGE.max ? opacity : null
}

export interface StrokeOp { t: 'stroke', tool: StrokeTool, c: string | null, p: number[], w?: number, a?: number }
export interface FillOp { t: 'fill', tool?: PaintTool, c: string, p: [number, number], a?: number }
export interface ClearOp { t: 'clear', p: [number, number] }
export interface ResetOp { t: 'reset' }
export interface StickerOp { t: 'sticker', id: StickerId, p: [number, number], size: number }
export type HistoryOp = StrokeOp | FillOp | ClearOp | ResetOp | StickerOp

export interface DrawingState {
  baseSeq: number
  hasBase: boolean
  ops: HistoryOp[]
  cursor: number
  progress: number
}

export interface HistorySave {
  fromSeq: number
  ops: HistoryOp[]
  cursor: number
  progress: number
}

export interface HistoryConflict {
  baseSeq: number
  head: number
}

export interface PaperGeometry {
  width: number
  height: number
  art: { x: number, y: number, width: number, height: number }
}

export function paperGeometry(artWidth: number, artHeight: number): PaperGeometry {
  const ratio = artWidth / artHeight
  const width = ratio >= 1 ? WORK_SIZE : Math.round(WORK_SIZE * ratio)
  const height = ratio >= 1 ? Math.round(WORK_SIZE / ratio) : WORK_SIZE
  const paperWidth = Math.max(width, Math.ceil(height * PAPER_MAX_ASPECT))
  const paperHeight = Math.max(height, Math.ceil(width / PAPER_MIN_ASPECT))
  return {
    width: paperWidth,
    height: paperHeight,
    art: { x: Math.round((paperWidth - width) / 2), y: Math.round((paperHeight - height) / 2), width, height }
  }
}

const COLORS = new Set(PALETTE.map(color => color.hex))

function isCoord(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_COORD
}

function toPoint(value: unknown): [number, number] | null {
  return Array.isArray(value) && value.length === 2 && isCoord(value[0]) && isCoord(value[1])
    ? [value[0], value[1]]
    : null
}

function isIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

export function parseHistoryOp(value: unknown): HistoryOp | null {
  if (!value || typeof value !== 'object') return null
  const op = value as Record<string, unknown>

  if (op.t === 'stroke') {
    const tool = op.tool
    if (tool !== 'brush' && tool !== 'pencil' && tool !== 'eraser') return null
    const color = tool === 'eraser' ? null : op.c
    if (color !== null && !(typeof color === 'string' && COLORS.has(color))) return null
    const points = op.p
    if (!Array.isArray(points) || points.length < 2 || points.length % 2 !== 0) return null
    if (points.length > MAX_STROKE_POINTS * 2 || !points.every(isCoord)) return null
    const stroke: StrokeOp = { t: 'stroke', tool, c: color, p: points as number[] }
    if (tool === 'eraser') return stroke
    if (op.w !== undefined) {
      const width = parseStrokeWidth(tool, op.w)
      if (width === null) return null
      stroke.w = width
    }
    if (op.a !== undefined) {
      const opacity = parseStrokeOpacity(op.a)
      if (opacity === null) return null
      stroke.a = opacity
    }
    return stroke
  }

  if (op.t === 'fill') {
    const point = toPoint(op.p)
    if (!point || typeof op.c !== 'string' || !COLORS.has(op.c)) return null
    const tool = op.tool ?? 'brush'
    if (tool !== 'brush' && tool !== 'pencil') return null
    const fill: FillOp = { t: 'fill', tool, c: op.c, p: point }
    if (op.a !== undefined) {
      const opacity = parseStrokeOpacity(op.a)
      if (opacity === null) return null
      fill.a = opacity
    }
    return fill
  }

  if (op.t === 'clear') {
    const point = toPoint(op.p)
    return point && { t: 'clear', p: point }
  }

  if (op.t === 'reset') return { t: 'reset' }

  if (op.t === 'sticker') {
    const point = toPoint(op.p)
    const size = parseStickerSize(op.size)
    return point && size !== null && isStickerId(op.id) ? { t: 'sticker', id: op.id, p: point, size } : null
  }

  return null
}

export function parseHistorySave(value: unknown): HistorySave | string {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const { fromSeq, cursor, progress } = body
  if (!isIndex(fromSeq) || !isIndex(cursor)) return 'Неверная позиция истории'
  if (!Array.isArray(body.ops) || body.ops.length > MAX_STORED_OPS) return 'Неверный список действий'
  const ops: HistoryOp[] = []
  for (const item of body.ops) {
    const op = parseHistoryOp(item)
    if (!op) return 'Неверное действие в истории'
    ops.push(op)
  }
  if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 100) {
    return 'Неверный процент заполнения'
  }
  return { fromSeq, ops, cursor, progress }
}
