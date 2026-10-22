export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Segment {
  id: number
  area: number
  background: boolean
  box: Box
}

export interface SegmentMap {
  width: number
  height: number
  labels: Int32Array
  paint: Int32Array
  segments: Segment[]
}

const LINE_LUMA = 170
const MIN_SEGMENT_AREA = 48
const UNDERLAY = 3
const GAP_CLOSE = 3
const MIN_CORE_AREA = 200

const LINE = -1
const UNVISITED = -2
const GAP = -3
const NEAR = -4

interface Region {
  area: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  edge: boolean
}

function addPixel(region: Region, x: number, y: number, width: number, height: number) {
  region.area += 1
  if (x < region.minX) region.minX = x
  if (x > region.maxX) region.maxX = x
  if (y < region.minY) region.minY = y
  if (y > region.maxY) region.maxY = y
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) region.edge = true
}

function neighbour(index: number, x: number, side: number, width: number, size: number): number {
  if (side === 0) return x > 0 ? index - 1 : -1
  if (side === 1) return x < width - 1 ? index + 1 : -1
  if (side === 2) return index >= width ? index - width : -1
  return index < size - width ? index + width : -1
}

export function buildSegmentMap(rgba: Uint8ClampedArray, width: number, height: number): SegmentMap {
  const size = width * height
  const labels = new Int32Array(size)

  let linesMinX = width
  let linesMinY = height
  let linesMaxX = -1
  let linesMaxY = -1
  for (let i = 0, y = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) {
      const r = rgba[i * 4]!
      const g = rgba[i * 4 + 1]!
      const b = rgba[i * 4 + 2]!
      const a = rgba[i * 4 + 3]! / 255
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a)
      if (luma < LINE_LUMA) {
        labels[i] = LINE
        if (x < linesMinX) linesMinX = x
        if (x > linesMaxX) linesMaxX = x
        if (y < linesMinY) linesMinY = y
        linesMaxY = y
      } else {
        labels[i] = UNVISITED
      }
    }
  }
  const lines: Box = { x: linesMinX, y: linesMinY, w: linesMaxX - linesMinX + 1, h: linesMaxY - linesMinY + 1 }

  if (lines.w > 0) markNearLines(labels, width, height, lines)
  const regions: Region[] = []
  const work: Work = { labels, stack: new Int32Array(size), queue: new Int32Array(size), tail: 0, width, height }
  const { queue } = work

  for (let start = 0; start < size; start++) {
    if (labels[start] !== UNVISITED) continue
    const from = work.tail
    const region = flood(work, start, regions.length, UNVISITED, true)
    if (region.area >= MIN_CORE_AREA) {
      regions.push(region)
      continue
    }
    work.tail = from
    flood(work, start, NEAR, regions.length, false)
  }

  let head = 0
  let tail = work.tail
  while (head < tail) {
    const index = queue[head++]!
    const id = labels[index]!
    const x = index % width
    for (let side = 0; side < 4; side++) {
      const next = neighbour(index, x, side, width, size)
      if (next < 0 || labels[next] !== NEAR) continue
      labels[next] = id
      queue[tail++] = next
      const nextX = next % width
      addPixel(regions[id]!, nextX, (next - nextX) / width, width, height)
    }
  }

  for (let start = 0; start < size; start++) {
    if (labels[start] === NEAR) regions.push(flood(work, start, regions.length, NEAR, false))
  }

  const remap = new Int32Array(regions.length)
  const segments: Segment[] = []
  regions.forEach((region, raw) => {
    if (region.area < MIN_SEGMENT_AREA) {
      remap[raw] = GAP
      return
    }
    remap[raw] = segments.length
    segments.push({
      id: segments.length,
      area: region.area,
      background: region.edge,
      box: { x: region.minX, y: region.minY, w: region.maxX - region.minX + 1, h: region.maxY - region.minY + 1 }
    })
  })
  for (let index = 0; index < size; index++) {
    const id = labels[index]!
    if (id >= 0) labels[index] = remap[id]!
  }

  const paint = extendUnderLines(labels, width, height, segments)
  for (let i = 0; i < size; i++) if (labels[i] === GAP) labels[i] = LINE
  return { width, height, labels, paint, segments }
}

interface Work {
  labels: Int32Array
  stack: Int32Array
  queue: Int32Array
  tail: number
  width: number
  height: number
}

function flood(work: Work, start: number, id: number, target: number, grow: boolean): Region {
  const { labels, stack, queue, width, height } = work
  let tail = work.tail
  let area = 0
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let edge = false
  let top = 0
  labels[start] = id
  stack[top++] = start
  while (top > 0) {
    const index = stack[--top]!
    const x = index % width
    const y = (index - x) / width
    area += 1
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge = true

    let label: number
    let border = false
    if (x > 0) {
      label = labels[index - 1]!
      if (label === target) { labels[index - 1] = id; stack[top++] = index - 1 } else if (label === NEAR) border = true
    }
    if (x < width - 1) {
      label = labels[index + 1]!
      if (label === target) { labels[index + 1] = id; stack[top++] = index + 1 } else if (label === NEAR) border = true
    }
    if (y > 0) {
      label = labels[index - width]!
      if (label === target) { labels[index - width] = id; stack[top++] = index - width } else if (label === NEAR) border = true
    }
    if (y < height - 1) {
      label = labels[index + width]!
      if (label === target) { labels[index + width] = id; stack[top++] = index + width } else if (label === NEAR) border = true
    }
    if (grow && border) queue[tail++] = index
  }
  work.tail = tail
  return { area, minX, minY, maxX, maxY, edge }
}

function markNearLines(labels: Int32Array, width: number, height: number, lines: Box) {
  const left = Math.max(0, lines.x - GAP_CLOSE)
  const top = Math.max(0, lines.y - GAP_CLOSE)
  const w = Math.min(width, lines.x + lines.w + GAP_CLOSE) - left
  const h = Math.min(height, lines.y + lines.h + GAP_CLOSE) - top
  const limit = GAP_CLOSE * 3
  const far = limit + 4
  const distance = new Uint8Array(w * h)
  for (let i = 0, y = 0; y < h; y++) {
    const row = (top + y) * width + left
    for (let x = 0; x < w; x++, i++) distance[i] = labels[row + x] === LINE ? 0 : far
  }

  for (let i = 0, y = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      let value = distance[i]!
      if (value === 0) continue
      if (x > 0) value = Math.min(value, distance[i - 1]! + 3)
      if (y > 0) {
        value = Math.min(value, distance[i - w]! + 3)
        if (x > 0) value = Math.min(value, distance[i - w - 1]! + 4)
        if (x < w - 1) value = Math.min(value, distance[i - w + 1]! + 4)
      }
      distance[i] = value
    }
  }
  for (let i = w * h - 1, y = h - 1; y >= 0; y--) {
    const row = (top + y) * width + left
    for (let x = w - 1; x >= 0; x--, i--) {
      let value = distance[i]!
      if (value === 0) continue
      if (x < w - 1) value = Math.min(value, distance[i + 1]! + 3)
      if (y < h - 1) {
        value = Math.min(value, distance[i + w]! + 3)
        if (x < w - 1) value = Math.min(value, distance[i + w + 1]! + 4)
        if (x > 0) value = Math.min(value, distance[i + w - 1]! + 4)
      }
      distance[i] = value
      if (value <= limit) labels[row + x] = NEAR
    }
  }
}

function extendUnderLines(labels: Int32Array, width: number, height: number, segments: Segment[]): Int32Array {
  const size = width * height
  const paint = labels.slice()
  const queue = new Int32Array(size)
  const distance = new Uint8Array(size)
  let head = 0
  let tail = 0

  for (let index = 0; index < size; index++) {
    if (paint[index]! < 0) continue
    const x = index % width
    if ((x > 0 && paint[index - 1]! < 0) || (x < width - 1 && paint[index + 1]! < 0)
      || (index >= width && paint[index - width]! < 0) || (index < size - width && paint[index + width]! < 0)) {
      queue[tail++] = index
    }
  }

  const visit = (from: number, next: number) => {
    let step: number
    if (paint[next] === GAP) step = 0
    else if (paint[next] === LINE && distance[from]! < UNDERLAY) step = distance[from]! + 1
    else return

    const id = paint[from]!
    paint[next] = id
    distance[next] = step
    queue[tail++] = next
    const segment = segments[id]
    if (segment) growBox(segment.box, next % width, Math.floor(next / width))
  }

  while (head < tail) {
    const index = queue[head++]!
    const x = index % width
    if (x > 0) visit(index, index - 1)
    if (x < width - 1) visit(index, index + 1)
    if (index >= width) visit(index, index - width)
    if (index < size - width) visit(index, index + width)
  }

  return paint
}

function growBox(box: Box, x: number, y: number) {
  if (x < box.x) { box.w += box.x - x; box.x = x }
  if (y < box.y) { box.h += box.y - y; box.y = y }
  if (x >= box.x + box.w) box.w = x - box.x + 1
  if (y >= box.y + box.h) box.h = y - box.y + 1
}
