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

export interface StrokeOp { t: 'stroke', tool: StrokeTool, c: string | null, p: number[] }
export interface FillOp { t: 'fill', tool?: Exclude<StrokeTool, 'eraser'>, c: string, p: [number, number] }
export interface ClearOp { t: 'clear', p: [number, number] }
export type HistoryOp = StrokeOp | FillOp | ClearOp

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
    return { t: 'stroke', tool, c: color, p: points as number[] }
  }

  if (op.t === 'fill') {
    const point = toPoint(op.p)
    if (!point || typeof op.c !== 'string' || !COLORS.has(op.c)) return null
    const tool = op.tool ?? 'brush'
    if (tool !== 'brush' && tool !== 'pencil') return null
    return { t: 'fill', tool, c: op.c, p: point }
  }

  if (op.t === 'clear') {
    const point = toPoint(op.p)
    return point && { t: 'clear', p: point }
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
