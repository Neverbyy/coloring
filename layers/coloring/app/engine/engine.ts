import { MAX_STROKE_POINTS, type HistoryOp, type StrokeOp, type StrokeTool } from '../../shared/history'
import type { Box, Segment, SegmentMap } from './segmentation'
import { TOOL_STYLES, createGrainPattern } from './textures'

// Касание попало на толстую линию — ищем ближайший сегмент в этом радиусе
const SNAP_RADIUS = 10
// Точки штриха ближе друг к другу не записываем
const MIN_POINT_DISTANCE = 2
// Пиксель закрашен, если непрозрачность не ниже (у карандаша с зерном она меньше 1)
const PAINTED_ALPHA = 24
// Сегмент, закрашенный на столько, считается закрашенным полностью:
// пальцем не дотянуться до каждого пикселя у контура
const SEGMENT_DONE = 0.95

interface ActiveStroke {
  op: StrokeOp
  segment: Segment
  lastX: number
  lastY: number
  // Где штрих уже нарисован — эту область переносим на холст в конце
  dirty: Box | null
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function context2d(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', options)
  if (!context) throw new Error('Canvas 2D недоступен')
  return context
}

// toBlob копирует холст в момент вызова — дальнейшее рисование в результат не попадёт
function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Картинка не создана')), type, quality)
  })
}

function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const w = Math.min(a.x + a.w, b.x + b.w) - x
  const h = Math.min(a.y + a.h, b.y + b.h) - y
  return w > 0 && h > 0 ? { x, y, w, h } : null
}

function union(a: Box | null, b: Box): Box {
  if (!a) return b
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

function drawRegion(target: CanvasRenderingContext2D, source: HTMLCanvasElement, box: Box) {
  target.drawImage(source, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h)
}

// Холсты: paint — краска (видна игроку), preview — текущий штрих до отпускания пальца.
// Контур картинки лежит поверх обоих (multiply), поэтому краска не закрывает линии.
// Штрих обрезается маской сегмента, в котором начался, — за линию он не выйдет
export class ColoringEngine {
  readonly width: number
  readonly height: number
  private readonly paint: CanvasRenderingContext2D
  private readonly preview: CanvasRenderingContext2D
  private readonly stroke: CanvasRenderingContext2D
  private readonly scratch: CanvasRenderingContext2D
  // Холст для подсчёта заполнения. С видимого холста пиксели не читаем: после частых чтений
  // Chrome переводит холст с видеокарты на процессор, и рисование на большой бумаге тормозит
  private readonly meter: CanvasRenderingContext2D
  // Холст для итоговой картинки и миниатюры — один на все сборки
  private readonly output: CanvasRenderingContext2D
  private readonly grain: CanvasPattern
  private readonly masks = new Map<number, HTMLCanvasElement>()
  // Доля закрашенных пикселей каждого сегмента
  private readonly coverage: Float64Array
  // Где лежат сегменты, входящие в процент (всё, кроме фона): заполнение считаем только тут,
  // а не по всей бумаге с полями
  private readonly countedBox: Box | null
  private active: ActiveStroke | null = null

  constructor(
    private readonly map: SegmentMap,
    paintCanvas: HTMLCanvasElement,
    private readonly previewCanvas: HTMLCanvasElement
  ) {
    this.width = map.width
    this.height = map.height
    for (const canvas of [paintCanvas, previewCanvas]) {
      canvas.width = this.width
      canvas.height = this.height
    }
    this.paint = context2d(paintCanvas)
    this.preview = context2d(previewCanvas)
    this.stroke = context2d(createCanvas(this.width, this.height))
    this.scratch = context2d(createCanvas(this.width, this.height))
    this.grain = createGrainPattern(this.preview)
    this.coverage = new Float64Array(map.segments.length)
    this.countedBox = map.segments
      .filter(segment => !segment.background)
      .reduce<Box | null>((box, segment) => union(box, segment.box), null)
    const meterBox = this.countedBox ?? { x: 0, y: 0, w: 1, h: 1 }
    this.meter = context2d(createCanvas(meterBox.w, meterBox.h), { willReadFrequently: true })
    this.output = context2d(createCanvas(1, 1))
  }

  // Невидимый движок на тех же сегментах — собрать состояние истории, не трогая экран
  static offscreen(map: SegmentMap): ColoringEngine {
    return new ColoringEngine(map, createCanvas(map.width, map.height), createCanvas(map.width, map.height))
  }

  get drawing(): boolean {
    return this.active !== null
  }

  segmentAt(x: number, y: number): Segment | null {
    const { width, height, paint, segments } = this.map
    const cx = Math.round(x)
    const cy = Math.round(y)
    let best = -1
    let bestDistance = Number.POSITIVE_INFINITY

    for (let dy = -SNAP_RADIUS; dy <= SNAP_RADIUS; dy++) {
      for (let dx = -SNAP_RADIUS; dx <= SNAP_RADIUS; dx++) {
        const px = cx + dx
        const py = cy + dy
        const distance = dx * dx + dy * dy
        if (px < 0 || py < 0 || px >= width || py >= height) continue
        if (distance > SNAP_RADIUS * SNAP_RADIUS || distance >= bestDistance) continue
        const id = paint[py * width + px]!
        if (id >= 0) {
          best = id
          bestDistance = distance
        }
      }
    }
    return segments[best] ?? null
  }

  // Живой штрих: начало. false — касание вне раскрашиваемых областей
  beginStroke(tool: StrokeTool, color: string, x: number, y: number): boolean {
    this.cancelStroke()
    const segment = this.segmentAt(x, y)
    if (!segment) return false

    const px = this.clampX(x)
    const py = this.clampY(y)
    this.active = {
      op: { t: 'stroke', tool, c: tool === 'eraser' ? null : color, p: [px, py] },
      segment,
      lastX: px,
      lastY: py,
      dirty: null
    }
    this.previewCanvas.style.opacity = String(TOOL_STYLES[tool].alpha)
    this.drawPath([px, py])
    return true
  }

  // Продолжение штриха пачкой точек (x1, y1, x2, y2, …): одна линия и одна перерисовка на кадр
  extendStroke(points: number[]) {
    const active = this.active
    if (!active) return
    const path = [active.lastX, active.lastY]
    for (let i = 0; i + 1 < points.length; i += 2) {
      if (active.op.p.length >= MAX_STROKE_POINTS * 2) break
      const px = this.clampX(points[i]!)
      const py = this.clampY(points[i + 1]!)
      if (Math.hypot(px - active.lastX, py - active.lastY) < MIN_POINT_DISTANCE) continue
      active.op.p.push(px, py)
      path.push(px, py)
      active.lastX = px
      active.lastY = py
    }
    if (path.length > 2) this.drawPath(path)
  }

  // Палец отпущен: штрих переносится на холст и становится операцией истории
  endStroke(measure = true): StrokeOp | null {
    const active = this.active
    if (!active) return null

    if (active.op.tool !== 'eraser' && active.dirty) {
      this.paint.save()
      this.paint.globalAlpha = TOOL_STYLES[active.op.tool].alpha
      drawRegion(this.paint, this.preview.canvas, active.dirty)
      this.paint.restore()
    }
    this.clearStroke(active)
    this.active = null
    if (measure) this.measure(active.segment)
    return active.op
  }

  // Удержание превратилось в заливку — штрих не нужен.
  // Стёртое резинкой не возвращается: очистка сегмента всё равно сотрёт его целиком
  cancelStroke() {
    if (!this.active) return
    this.clearStroke(this.active)
    this.active = null
  }

  // Выполнить операцию истории (новое действие, повтор, восстановление).
  // При доигрывании многих операций заполнение считают один раз в конце (measureAll)
  apply(op: HistoryOp, measure = true): Segment | null {
    if (op.t === 'stroke') {
      const segment = this.segmentAt(op.p[0]!, op.p[1]!)
      if (!segment) return null
      this.active = { op, segment, lastX: op.p[0]!, lastY: op.p[1]!, dirty: null }
      this.drawPath(op.p, segment.box)
      this.endStroke(measure)
      return segment
    }

    const segment = this.segmentAt(op.p[0], op.p[1])
    if (!segment) return null
    if (op.t === 'fill') this.fillSegment(segment, op.c)
    else this.clearSegment(segment)
    if (measure) this.measure(segment)
    return segment
  }

  reset() {
    this.active = null
    this.paint.clearRect(0, 0, this.width, this.height)
    this.preview.clearRect(0, 0, this.width, this.height)
    this.stroke.clearRect(0, 0, this.width, this.height)
    this.coverage.fill(0)
  }

  // Холст из снимка истории
  restore(image: CanvasImageSource) {
    this.reset()
    this.paint.drawImage(image, 0, 0, this.width, this.height)
  }

  // Снимок краски (PNG с прозрачностью) — для истории и базового изображения
  snapshot(): Promise<Blob> {
    return toBlob(this.paint.canvas, 'image/png')
  }

  // Картинка результата без интерфейса (PNG): область картинки на бумаге — белый фон, краска, контур
  exportImage(lineArt: CanvasImageSource, art: Box): Promise<Blob> {
    return toBlob(this.composite(lineArt, art, art, 1), 'image/png')
  }

  // Миниатюра для галереи: вся бумага с полями (карточка раскладывает её как экран рисования),
  // длинная сторона maxSide, JPEG (белый фон — без прозрачности)
  thumbnail(lineArt: CanvasImageSource, art: Box, maxSide: number): Promise<Blob> {
    const paper = { x: 0, y: 0, w: this.width, h: this.height }
    const scale = Math.min(1, maxSide / Math.max(paper.w, paper.h))
    return toBlob(this.composite(lineArt, art, paper, scale), 'image/jpeg', 0.85)
  }

  // Процент заполнения 0–100: по площади областей, фон не учитывается
  progress(): number {
    let total = 0
    let painted = 0
    for (const segment of this.map.segments) {
      if (segment.background) continue
      const coverage = this.coverage[segment.id]!
      total += segment.area
      painted += segment.area * (coverage >= SEGMENT_DONE ? 1 : coverage)
    }
    return total > 0 ? (painted / total) * 100 : 0
  }

  // Пересчитать заполнение всех сегментов (после восстановления истории)
  measureAll() {
    this.measure()
  }

  // Заполнение одного сегмента или (без аргумента) всех, кроме фона: фон в процент не входит,
  // а по площади он — почти вся бумага
  private measure(segment?: Segment) {
    if (segment?.background) return
    const box = segment ? segment.box : this.countedBox
    if (!box) return

    const { meter } = this
    meter.clearRect(0, 0, box.w, box.h)
    meter.drawImage(this.paint.canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
    const data = meter.getImageData(0, 0, box.w, box.h).data
    const { width, labels, segments } = this.map
    const only = segment?.id
    const counts = new Float64Array(segments.length)
    for (let y = 0; y < box.h; y++) {
      const row = (box.y + y) * width + box.x
      for (let x = 0; x < box.w; x++) {
        const id = labels[row + x]!
        if (id >= 0 && (only === undefined || id === only) && data[(y * box.w + x) * 4 + 3]! >= PAINTED_ALPHA) counts[id]!++
      }
    }

    for (const item of segment ? [segment] : segments) {
      if (!item.background) this.coverage[item.id] = counts[item.id]! / item.area
    }
  }

  // Область crop бумаги в масштабе scale; контур картинки ложится на её место art
  private composite(lineArt: CanvasImageSource, art: Box, crop: Box, scale: number): HTMLCanvasElement {
    const { output } = this
    const width = Math.round(crop.w * scale)
    const height = Math.round(crop.h * scale)
    // Смена размера очищает холст и сбрасывает его настройки
    output.canvas.width = width
    output.canvas.height = height
    output.fillStyle = '#ffffff'
    output.fillRect(0, 0, width, height)
    output.drawImage(this.paint.canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)
    output.globalCompositeOperation = 'multiply'
    output.drawImage(lineArt, (art.x - crop.x) * scale, (art.y - crop.y) * scale, art.w * scale, art.h * scale)
    return output.canvas
  }

  // Нарисовать часть штриха (точки подряд; одна точка — круглый след) и перерисовать её область.
  // area — готовая область перерисовки (повтор целого штриха); иначе считается по точкам
  private drawPath(points: number[], area?: Box) {
    const active = this.active!
    const style = TOOL_STYLES[active.op.tool]
    const context = this.stroke
    const radius = style.width / 2
    context.fillStyle = context.strokeStyle = active.op.c ?? '#000000'
    context.lineWidth = style.width
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()

    let minX = points[0]!
    let minY = points[1]!
    let maxX = minX
    let maxY = minY
    if (points.length === 2) {
      context.arc(minX, minY, radius, 0, Math.PI * 2)
      context.fill()
    } else {
      context.moveTo(minX, minY)
      for (let i = 2; i + 1 < points.length; i += 2) {
        const x = points[i]!
        const y = points[i + 1]!
        context.lineTo(x, y)
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      context.stroke()
    }

    const pad = radius + 2
    this.flush(area ?? { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 })
  }

  // Перерисовать область штриха: обрезать маской сегмента, наложить зерно;
  // у резинки — сразу стереть краску в этой области
  private flush(area: Box) {
    const active = this.active!
    const rounded = {
      x: Math.floor(area.x),
      y: Math.floor(area.y),
      w: Math.ceil(area.w) + 1,
      h: Math.ceil(area.h) + 1
    }
    const segmentBox = active.segment.box
    const box = intersect(rounded, segmentBox)
    if (!box) return
    active.dirty = union(active.dirty, box)

    const style = TOOL_STYLES[active.op.tool]
    const eraser = active.op.tool === 'eraser'
    const target = eraser ? this.scratch : this.preview

    target.save()
    // destination-in в части браузеров действует на весь холст — ограничиваем областью
    target.beginPath()
    target.rect(box.x, box.y, box.w, box.h)
    target.clip()
    target.clearRect(box.x, box.y, box.w, box.h)
    drawRegion(target, this.stroke.canvas, box)
    target.globalCompositeOperation = 'destination-in'
    // Маска — только кусок под областью: у фона она размером со всю бумагу
    target.drawImage(this.mask(active.segment), box.x - segmentBox.x, box.y - segmentBox.y, box.w, box.h, box.x, box.y, box.w, box.h)
    if (style.grain) {
      target.fillStyle = this.grain
      target.fillRect(box.x, box.y, box.w, box.h)
    }
    target.restore()

    if (eraser) {
      this.paint.save()
      this.paint.globalCompositeOperation = 'destination-out'
      drawRegion(this.paint, this.scratch.canvas, box)
      this.paint.restore()
    }
  }

  private fillSegment(segment: Segment, color: string) {
    const { box } = segment
    const context = this.scratch
    context.save()
    context.clearRect(box.x, box.y, box.w, box.h)
    context.fillStyle = color
    context.fillRect(box.x, box.y, box.w, box.h)
    context.globalCompositeOperation = 'destination-in'
    context.drawImage(this.mask(segment), box.x, box.y)
    context.restore()
    drawRegion(this.paint, this.scratch.canvas, box)
  }

  private clearSegment(segment: Segment) {
    this.paint.save()
    this.paint.globalCompositeOperation = 'destination-out'
    this.paint.drawImage(this.mask(segment), segment.box.x, segment.box.y)
    this.paint.restore()
  }

  private clearStroke(active: ActiveStroke) {
    const { box } = active.segment
    this.stroke.clearRect(box.x, box.y, box.w, box.h)
    this.preview.clearRect(box.x, box.y, box.w, box.h)
  }

  // Маска сегмента: непрозрачно там, где разрешена краска
  private mask(segment: Segment): HTMLCanvasElement {
    const cached = this.masks.get(segment.id)
    if (cached) return cached

    const { box } = segment
    const canvas = createCanvas(box.w, box.h)
    const context = context2d(canvas)
    const image = context.createImageData(box.w, box.h)
    const { width, paint } = this.map
    for (let y = 0; y < box.h; y++) {
      const row = (box.y + y) * width + box.x
      for (let x = 0; x < box.w; x++) {
        if (paint[row + x] === segment.id) image.data[(y * box.w + x) * 4 + 3] = 255
      }
    }
    context.putImageData(image, 0, 0)
    this.masks.set(segment.id, canvas)
    return canvas
  }

  private clampX(x: number): number {
    return Math.min(this.width, Math.max(0, Math.round(x)))
  }

  private clampY(y: number): number {
    return Math.min(this.height, Math.max(0, Math.round(y)))
  }
}
