// Разметка картинки-раскраски на сегменты — области между линиями.
// Работает с любым источником (PNG, SVG): картинка растеризуется, тёмные пиксели — линии,
// связные области светлых пикселей — сегменты. Чистые вычисления без DOM

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Segment {
  id: number
  // Пикселей самой области (без зоны под линией) — по ним считается заполнение
  area: number
  // Область касается края картинки — это фон: красить можно, в процент не входит
  background: boolean
  // Где можно красить: область вместе с зоной под линией
  box: Box
}

export interface SegmentMap {
  width: number
  height: number
  // Номер сегмента для каждого пикселя области, -1 — линия
  labels: Int32Array
  // То же, но с зоной под линией: здесь краска допустима
  paint: Int32Array
  segments: Segment[]
}

// Темнее этого (яркость 0–255 с учётом прозрачности) — линия
const LINE_LUMA = 170
// Области меньше — щели в линиях и мусор, красить там нечего
const MIN_SEGMENT_AREA = 48
// Насколько пикселей краска заходит под линию — иначе между цветом и контуром светлая кайма
const UNDERLAY = 3

const LINE = -1
const UNVISITED = -2
// Светлая щель меньше MIN_SEGMENT_AREA (стык линий): своей области нет, краску получает от соседей
const GAP = -3

export function buildSegmentMap(rgba: Uint8ClampedArray, width: number, height: number): SegmentMap {
  const size = width * height
  const labels = new Int32Array(size)

  for (let i = 0; i < size; i++) {
    const r = rgba[i * 4]!
    const g = rgba[i * 4 + 1]!
    const b = rgba[i * 4 + 2]!
    const a = rgba[i * 4 + 3]! / 255
    // Прозрачное — белая бумага
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a)
    labels[i] = luma < LINE_LUMA ? LINE : UNVISITED
  }

  // Заливка областей: стек вместо рекурсии; order хранит пиксели области подряд
  const stack = new Int32Array(size)
  const order = new Int32Array(size)
  const segments: Segment[] = []

  for (let start = 0; start < size; start++) {
    if (labels[start] !== UNVISITED) continue
    const id = segments.length
    let top = 0
    let count = 0
    let background = false
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    labels[start] = id
    stack[top++] = start
    while (top > 0) {
      const index = stack[--top]!
      order[count++] = index
      const x = index % width
      const y = (index - x) / width
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) background = true

      if (x > 0 && labels[index - 1] === UNVISITED) { labels[index - 1] = id; stack[top++] = index - 1 }
      if (x < width - 1 && labels[index + 1] === UNVISITED) { labels[index + 1] = id; stack[top++] = index + 1 }
      if (y > 0 && labels[index - width] === UNVISITED) { labels[index - width] = id; stack[top++] = index - width }
      if (y < height - 1 && labels[index + width] === UNVISITED) { labels[index + width] = id; stack[top++] = index + width }
    }

    if (count < MIN_SEGMENT_AREA) {
      for (let i = 0; i < count; i++) labels[order[i]!] = GAP
      continue
    }
    segments.push({ id, area: count, background, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } })
  }

  const paint = extendUnderLines(labels, width, height, segments)
  // В подсчёте заполнения щели — как линии
  for (let i = 0; i < size; i++) if (labels[i] === GAP) labels[i] = LINE
  return { width, height, labels, paint, segments }
}

// Пиксели линии отдаются ближайшему сегменту (не дальше UNDERLAY): краска заходит под контур.
// Щели отдаются целиком, иначе на стыках линий оставались бы белые точки
function extendUnderLines(labels: Int32Array, width: number, height: number, segments: Segment[]): Int32Array {
  const size = width * height
  const paint = labels.slice()
  const queue = new Int32Array(size)
  const distance = new Uint8Array(size)
  let head = 0
  let tail = 0

  // Старт — пиксели сегментов, граничащие с линией или щелью
  const free = (index: number) => paint[index] === LINE || paint[index] === GAP
  for (let index = 0; index < size; index++) {
    if (paint[index]! < 0) continue
    const x = index % width
    if ((x > 0 && free(index - 1)) || (x < width - 1 && free(index + 1))
      || (index >= width && free(index - width)) || (index < size - width && free(index + width))) {
      queue[tail++] = index
    }
  }

  // Щель — без ограничения расстояния; от неё снова можно зайти под линию на UNDERLAY
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
