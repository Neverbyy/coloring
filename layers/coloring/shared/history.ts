import { PALETTE } from './palette'

// Общие для клиента и сервера типы истории рисунка.
// Рабочее пространство — бумага (см. paperGeometry): длинная сторона картинки на ней — WORK_SIZE точек,
// в координатах бумаги записаны операции.
// Сегмент операции определяется по её точке, а не по номеру: растеризация картинки в разных
// браузерах чуть отличается, и номера областей могли бы разъехаться.
//
// Хранение: рисунок = базовое изображение (PNG) + последние операции после него.
// Отменить можно не меньше HISTORY_LIMIT последних действий; более старые «запекаются»
// в базовое изображение пачками по BAKE_CHUNK. На сервере это одна строка на рисунок
export const WORK_SIZE = 1024
// Бумага = картинка + поля вокруг: рисовать можно во всей рамке, а рамка бывает и шире картинки
// (компьютер), и выше (телефон вертикально). Размер бумаги зависит только от арта, не от экрана,
// поэтому история одинакова на любом устройстве. Бумага покрывает рамки с соотношением
// сторон области рисунка от 0.5 (высокая) до PAPER_MAX_ASPECT (широкая) — шире и выше экран
// рисования не даёт (см. .board). Вертикальный запас больше: под кнопками отмены рамка ниже рисунка
export const PAPER_MAX_ASPECT = 1.6
export const PAPER_MIN_ASPECT = 0.4
// Наибольшая координата на бумаге любого арта
export const MAX_COORD = Math.ceil(WORK_SIZE / PAPER_MIN_ASPECT)
export const HISTORY_LIMIT = 50
export const BAKE_CHUNK = 20
// Снимок холста в памяти браузера не реже чем через столько операций: отмена = снимок + доигрывание
export const SNAPSHOT_INTERVAL = 20
// Предел операций в строке на сервере — с запасом на случай, если базовое изображение
// ещё не дошло (нет сети)
export const MAX_STORED_OPS = 300
export const MAX_STROKE_POINTS = 5000
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
export const MAX_THUMBNAIL_BYTES = 512 * 1024

export type StrokeTool = 'brush' | 'pencil' | 'eraser'

// p — точки штриха подряд: x1, y1, x2, y2, …
export interface StrokeOp { t: 'stroke', tool: StrokeTool, c: string | null, p: number[] }
// Удержание кисти или карандаша — заливка сегмента в точке p: кисть — ровным цветом,
// карандаш — с фактурой. Без tool — кисть (так записаны заливки до появления поля)
export interface FillOp { t: 'fill', tool?: Exclude<StrokeTool, 'eraser'>, c: string, p: [number, number] }
// Удержание резинки — очистка сегмента в точке p
export interface ClearOp { t: 'clear', p: [number, number] }
export type HistoryOp = StrokeOp | FillOp | ClearOp

// Номера операций сквозные: первая операция рисунка — 1, «запекание» их не сбрасывает
export interface DrawingState {
  // Сколько первых операций уже в базовом изображении
  baseSeq: number
  // Есть ли базовое изображение (иначе база — чистый холст)
  hasBase: boolean
  // Операции после базы: номера baseSeq + 1 … baseSeq + ops.length
  ops: HistoryOp[]
  // Позиция undo/redo: baseSeq ≤ cursor ≤ baseSeq + ops.length
  cursor: number
  progress: number
}

// Сохранение: заменить операции после fromSeq на ops и поставить курсор (undo/redo)
export interface HistorySave {
  fromSeq: number
  ops: HistoryOp[]
  cursor: number
  progress: number
}

// Ответ сервера при расхождении (409): что у него сейчас
export interface HistoryConflict {
  baseSeq: number
  head: number
}

export interface PaperGeometry {
  width: number
  height: number
  // Где на бумаге картинка
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

// Проверка операции из недоверенного источника. Возвращает чистый объект без лишних полей
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

// Тело сохранения истории из недоверенного источника: готовый объект или текст ошибки
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
