import { MAX_STROKE_POINTS, type HistoryOp, type StrokeOp, type StrokeTool } from '#layers/coloring/shared/history'
import type { Box, Segment, SegmentMap } from './segmentation'
import { context2d, createCanvas } from './canvas'
import { TOOL_STYLES, createPencilTexture } from './textures'

const SNAP_RADIUS = 10
const MIN_POINT_DISTANCE = 2
const PAINTED_ALPHA = 24
const SEGMENT_DONE = 0.95
const CHANGE_TOLERANCE = 2

interface ActiveStroke {
  op: StrokeOp
  segment: Segment
  lastX: number
  lastY: number
  dirty: Box | null
  restorable: boolean
  knockout: boolean
}

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

export class ColoringEngine {
  readonly width: number
  readonly height: number
  private readonly paint: CanvasRenderingContext2D
  private readonly preview: CanvasRenderingContext2D
  private readonly stroke: CanvasRenderingContext2D
  private readonly scratch: CanvasRenderingContext2D
  private readonly meter: CanvasRenderingContext2D
  private readonly output: CanvasRenderingContext2D
  private readonly texture: CanvasPattern
  private readonly masks = new Map<number, HTMLCanvasElement>()
  private readonly coverage: Float64Array
  private readonly countedBox: Box | null
  private active: ActiveStroke | null = null
  private backup: CanvasRenderingContext2D | null = null
  private probe: CanvasRenderingContext2D | null = null

  constructor(
    private readonly map: SegmentMap,
    paintCanvas: HTMLCanvasElement,
    previewCanvas: HTMLCanvasElement
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
    this.texture = createPencilTexture(this.preview)
    this.coverage = new Float64Array(map.segments.length)
    this.countedBox = map.segments
      .filter(segment => !segment.background)
      .reduce<Box | null>((box, segment) => union(box, segment.box), null)
    const meterBox = this.countedBox ?? { x: 0, y: 0, w: 1, h: 1 }
    this.meter = context2d(createCanvas(meterBox.w, meterBox.h), { willReadFrequently: true })
    this.output = context2d(createCanvas(1, 1))
  }

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

  beginStroke(tool: StrokeTool, color: string, x: number, y: number, width?: number, opacity?: number): boolean {
    this.cancelStroke()
    const segment = this.segmentAt(x, y)
    if (!segment) return false

    const px = this.clampX(x)
    const py = this.clampY(y)
    const eraser = tool === 'eraser'
    const knockout = !eraser && opacity !== undefined && opacity < 1
    const restorable = eraser || knockout
    if (restorable) this.saveBackup(segment.box)
    const op: StrokeOp = { t: 'stroke', tool, c: eraser ? null : color, p: [px, py] }
    if (!eraser && width !== undefined) op.w = width
    if (!eraser && opacity !== undefined) op.a = opacity
    this.active = {
      op,
      segment,
      lastX: px,
      lastY: py,
      dirty: null,
      restorable,
      knockout
    }
    this.drawPath([px, py])
    return true
  }

  hasAnyPaint(): boolean {
    const data = this.read(this.paint.canvas, { x: 0, y: 0, w: this.width, h: this.height })
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! > 0) return true
    }
    return false
  }

  hasPaint(x: number, y: number): boolean {
    const segment = this.segmentAt(x, y)
    if (!segment) return false
    const { box, id } = segment
    const data = this.read(this.paint.canvas, box)
    const { width, paint } = this.map
    for (let row = 0; row < box.h; row++) {
      const offset = (box.y + row) * width + box.x
      for (let column = 0; column < box.w; column++) {
        if (paint[offset + column] === id && data[(row * box.w + column) * 4 + 3]! > 0) return true
      }
    }
    return false
  }

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

  endStroke(measure = true): StrokeOp | null {
    const active = this.active
    if (!active) return null
    if (active.restorable && !this.changed(active)) {
      this.cancelStroke()
      return null
    }

    if (!active.knockout && active.op.tool !== 'eraser' && active.dirty) drawRegion(this.paint, this.preview.canvas, active.dirty)
    this.clearStroke(active)
    this.active = null
    if (measure) this.measure(active.segment)
    return active.op
  }

  cancelStroke() {
    const active = this.active
    if (!active) return
    if (active.restorable && active.dirty && this.backup) {
      const { x, y, w, h } = active.dirty
      this.paint.clearRect(x, y, w, h)
      drawRegion(this.paint, this.backup.canvas, active.dirty)
    }
    this.clearStroke(active)
    this.active = null
  }

  apply(op: HistoryOp, measure = true): Segment | null {
    if (op.t === 'stroke') {
      const segment = this.segmentAt(op.p[0]!, op.p[1]!)
      if (!segment) return null
      const knockout = op.tool !== 'eraser' && (op.a ?? 1) < 1
      if (knockout) this.saveBackup(segment.box)
      this.active = { op, segment, lastX: op.p[0]!, lastY: op.p[1]!, dirty: null, restorable: false, knockout }
      this.drawPath(op.p, segment.box)
      this.endStroke(measure)
      return segment
    }

    if (op.t === 'reset') {
      this.reset()
      return null
    }

    const segment = this.segmentAt(op.p[0], op.p[1])
    if (!segment) return null
    if (op.t === 'fill') this.fillSegment(segment, op.c, op.tool === 'pencil', op.a ?? 1)
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

  restore(image: CanvasImageSource) {
    this.reset()
    this.paint.drawImage(image, 0, 0, this.width, this.height)
  }

  snapshot(): Promise<Blob> {
    return toBlob(this.paint.canvas, 'image/png')
  }

  exportImage(lineArt: CanvasImageSource, art: Box): Promise<Blob> {
    return toBlob(this.composite(lineArt, art, art, 1), 'image/png')
  }

  thumbnail(lineArt: CanvasImageSource, art: Box, maxSide: number): Promise<Blob> {
    const paper = { x: 0, y: 0, w: this.width, h: this.height }
    const scale = Math.min(1, maxSide / Math.max(paper.w, paper.h))
    return toBlob(this.composite(lineArt, art, paper, scale), 'image/jpeg', 0.85)
  }

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

  measureAll() {
    this.measure()
  }

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

  private composite(lineArt: CanvasImageSource, art: Box, crop: Box, scale: number): HTMLCanvasElement {
    const { output } = this
    const width = Math.round(crop.w * scale)
    const height = Math.round(crop.h * scale)
    output.canvas.width = width
    output.canvas.height = height
    output.fillStyle = '#ffffff'
    output.fillRect(0, 0, width, height)
    output.drawImage(this.paint.canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)
    output.globalCompositeOperation = 'multiply'
    output.drawImage(lineArt, (art.x - crop.x) * scale, (art.y - crop.y) * scale, art.w * scale, art.h * scale)
    return output.canvas
  }

  private drawPath(points: number[], area?: Box) {
    const active = this.active!
    const width = active.op.w ?? TOOL_STYLES[active.op.tool].width
    const context = this.stroke
    const radius = width / 2
    const { box } = active.segment
    context.save()
    context.beginPath()
    context.rect(box.x, box.y, box.w, box.h)
    context.clip()
    context.fillStyle = context.strokeStyle = active.op.c ?? '#000000'
    context.lineWidth = width
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
    context.restore()

    const pad = radius + 2
    this.flush(area ?? { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 })
  }

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
    const target = eraser || active.knockout ? this.scratch : this.preview

    target.save()
    target.beginPath()
    target.rect(box.x, box.y, box.w, box.h)
    target.clip()
    target.clearRect(box.x, box.y, box.w, box.h)
    drawRegion(target, this.stroke.canvas, box)
    target.globalCompositeOperation = 'destination-in'
    target.drawImage(this.mask(active.segment), box.x - segmentBox.x, box.y - segmentBox.y, box.w, box.h, box.x, box.y, box.w, box.h)
    if (style.textured) this.applyTexture(target, box)
    target.restore()

    if (eraser) this.erase(() => drawRegion(this.paint, this.scratch.canvas, box))
    else if (active.knockout) this.replace(box, active.op.a ?? 1)
  }

  private replace(box: Box, opacity: number) {
    const { paint } = this
    paint.save()
    paint.clearRect(box.x, box.y, box.w, box.h)
    if (this.backup) drawRegion(paint, this.backup.canvas, box)
    paint.globalCompositeOperation = 'destination-out'
    drawRegion(paint, this.scratch.canvas, box)
    paint.globalCompositeOperation = 'lighter'
    paint.globalAlpha = opacity
    drawRegion(paint, this.scratch.canvas, box)
    paint.restore()
  }

  private applyTexture(context: CanvasRenderingContext2D, box: Box) {
    context.globalCompositeOperation = 'source-atop'
    context.fillStyle = this.texture
    context.fillRect(box.x, box.y, box.w, box.h)
  }

  private fillSegment(segment: Segment, color: string, textured: boolean, opacity: number) {
    const { box } = segment
    const context = this.scratch
    context.save()
    context.clearRect(box.x, box.y, box.w, box.h)
    context.fillStyle = color
    context.globalAlpha = opacity
    context.fillRect(box.x, box.y, box.w, box.h)
    context.globalAlpha = 1
    if (textured) this.applyTexture(context, box)
    context.globalCompositeOperation = 'destination-in'
    context.drawImage(this.mask(segment), box.x, box.y)
    context.restore()
    this.clearSegment(segment)
    drawRegion(this.paint, this.scratch.canvas, box)
  }

  private clearSegment(segment: Segment) {
    this.erase(() => this.paint.drawImage(this.mask(segment), segment.box.x, segment.box.y))
  }

  private erase(draw: () => void) {
    this.paint.save()
    this.paint.globalCompositeOperation = 'destination-out'
    draw()
    this.paint.restore()
  }

  private saveBackup(box: Box) {
    this.backup ??= context2d(createCanvas(this.width, this.height))
    this.backup.clearRect(box.x, box.y, box.w, box.h)
    drawRegion(this.backup, this.paint.canvas, box)
  }

  private changed({ dirty }: ActiveStroke): boolean {
    if (!dirty || !this.backup) return false
    const before = this.read(this.backup.canvas, dirty)
    const after = this.read(this.paint.canvas, dirty)
    for (let i = 0; i < before.length; i++) {
      if (Math.abs(before[i]! - after[i]!) > CHANGE_TOLERANCE) return true
    }
    return false
  }

  private read(source: HTMLCanvasElement, box: Box): Uint8ClampedArray {
    this.probe ??= context2d(createCanvas(this.width, this.height), { willReadFrequently: true })
    this.probe.clearRect(0, 0, box.w, box.h)
    this.probe.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
    return this.probe.getImageData(0, 0, box.w, box.h).data
  }

  private clearStroke(active: ActiveStroke) {
    const { box } = active.segment
    this.stroke.clearRect(box.x, box.y, box.w, box.h)
    this.preview.clearRect(box.x, box.y, box.w, box.h)
  }

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
