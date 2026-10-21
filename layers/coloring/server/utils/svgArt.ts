import { optimize, type CustomPlugin, type XastElement, type XastRoot } from 'svgo'
import { IMPORT_MESSAGES, MAX_SVG_BYTES } from '../../shared/gallery'
import { WORK_SIZE } from '../../shared/history'

// Подготовка SVG к раскраске. Движок строит сегменты по растру (тёмные пиксели — линии),
// поэтому рисунок становится чёрно-белым. Два вида файлов:
// - фигуры (Figma: заливки, перо): каждая фигура — белая область с чёрной обводкой. Порядок фигур
//   сохраняется, поэтому что в Figma закрыто верхней фигурой, закрыто и здесь. Тёмные заливки —
//   это линии, они остаются чёрными;
// - трассированная картинка (potrace, VTracer: PNG → SVG): серые заливки без обводок, линии — тёмные
//   места между светлыми кусками. Каждая заливка → чёрная или белая по яркости, без обводок:
//   иначе каждый кусок (и даже «шахматка» фальшивой прозрачности из PNG) получил бы свою рамку.
// Заодно это санитизация: остаётся только белый список элементов и атрибутов.
// Функция не зависит от БД — её же использует импорт игрока и (позже) админка

export interface SvgArt {
  svg: string
  // Размер картинки: длинная сторона — WORK_SIZE, как у рабочего растра
  width: number
  height: number
  // Что пропущено — показать игроку
  notes: string[]
}

const MAX_SHAPES = 5000
const MAX_ELEMENTS = 20000
const MAX_ASPECT = 8
// Толщина линий в пикселях рабочего растра: тоньше минимальной — линия рвётся при растеризации
// и краска перетекает в соседнюю область; стандартная — для фигур без обводки
const MIN_LINE = 3
const DEFAULT_LINE = 6
// Заливка темнее этого (яркость 0–1) — «чернила»: сама линия рисунка, а не область.
// Так нарисованы трассированные картинки (potrace и т. п.): контуры — чёрные залитые фигуры
const INK_LUMA = 0.35
// Трассированная картинка: темнее — линия, светлее — бумага. Серый — разброс каналов не больше этого
const TRACE_LUMA = 0.5
const GRAY_SPREAD = 0.06
// Прямоугольник без обводки почти во весь рисунок — фон фрейма Figma, не область для раскраски
const BACKGROUND_COVER = 0.99

const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])
const MASKS = new Set(['mask', 'clipPath'])
// Неподдерживаемое содержимое, о пропуске которого стоит сказать игроку
const SKIPPED_CONTENT = new Set(['text', 'image', 'foreignObject', 'use', 'switch'])

const ATTRIBUTES = new Set([
  'xmlns', 'viewBox', 'preserveAspectRatio', 'id', 'transform',
  'd', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points',
  'fill', 'fill-rule', 'clip-rule', 'fill-opacity', 'opacity', 'display', 'visibility',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity',
  'clip-path', 'mask', 'maskUnits', 'maskContentUnits', 'clipPathUnits'
])
// Ссылки — только на элементы внутри файла
const LOCAL_URL = /^url\(\s*['"]?#[\w.:-]+['"]?\s*\)$/

const MESSAGES = {
  notSvg: 'Файл повреждён или это не SVG',
  entities: 'В файле есть DOCTYPE с сущностями — экспортируй SVG из Figma заново',
  size: 'Не указан размер рисунка — экспортируй SVG из Figma заново',
  aspect: 'Рисунок слишком вытянутый — подойдёт что-то ближе к квадрату',
  complex: 'Рисунок слишком сложный — в нём больше 5000 фигур',
  tooBig: IMPORT_MESSAGES.tooBig,
  onlySkipped: 'В файле только текст или картинки — нарисуй рисунок в Figma пером или фигурами',
  empty: 'В файле нет фигур — нарисуй рисунок в Figma пером или фигурами',
  skipped: 'Текст и вставленные картинки пропущены — раскрашиваются только фигуры и линии'
}

function fail(message: string): never {
  throw createError({ statusCode: 422, message })
}

interface Paint {
  fill: string
  stroke: string
  strokeWidth: number
  fillOpacity: number
  strokeOpacity: number
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface Context {
  paint: Paint
  // Есть transform у предков — геометрия в других координатах
  transformed: boolean
  // Во сколько раз transform предков увеличивает размеры: толщина обводки задаётся в своих единицах
  scale: number
  // Внутри mask/clipPath: фигуры — не рисунок, а форма маски, их не перекрашиваем
  inMask: boolean
}

// Фигура рисунка: перекрашивается после обхода, когда известен вид файла
interface Shape {
  node: XastElement
  parent: XastElement
  paint: Paint
  context: Context
  filled: boolean
  stroked: boolean
}

interface State {
  box: Box
  minLine: number
  defaultLine: number
  elements: number
  shapes: Shape[]
  skipped: boolean
}

// По умолчанию в SVG заливка чёрная, обводки нет
const DEFAULT_PAINT: Paint = { fill: 'black', stroke: 'none', strokeWidth: 1, fillOpacity: 1, strokeOpacity: 1 }

function isElement(node: { type: string }): node is XastElement {
  return node.type === 'element'
}

function number(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim().endsWith('%')) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function hasPaint(value: string): boolean {
  return value !== 'none' && value !== 'transparent' && value !== ''
}

// Цвет как [r, g, b] (0–1). Названия и rgb() к этому моменту уже переведены в #hex (convertColors);
// currentColor без color — чёрный. Градиенты и прочее — null
function parseColor(value: string): [number, number, number] | null {
  if (value.toLowerCase() === 'currentcolor') return [0, 0, 0]
  const hex = /^#([\da-f]{3,8})$/i.exec(value)?.[1]
  if (!hex || hex.length === 5 || hex.length === 7) return null
  const full = hex.length <= 4 ? [...hex.slice(0, 3)].map(c => c + c).join('') : hex.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map(i => Number.parseInt(full.slice(i, i + 2), 16) / 255)
  return [r!, g!, b!]
}

function luma([r, g, b]: [number, number, number]): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function isDark(value: string): boolean {
  const color = parseColor(value)
  return color !== null && luma(color) < INK_LUMA
}

function isGray(value: string): boolean {
  const color = parseColor(value)
  return color !== null && Math.max(...color) - Math.min(...color) <= GRAY_SPREAD
}

// Увеличение размеров от transform (корень из модуля определителя матрицы)
function transformScale(value: string): number {
  let [a, b, c, d] = [1, 0, 0, 1]
  for (const [, name, args] of value.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const n = args!.split(/[\s,]+/).filter(Boolean).map(Number)
    let t = [1, 0, 0, 1]
    if (name === 'matrix') t = [n[0] ?? 1, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1]
    else if (name === 'scale') t = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1]
    else if (name === 'rotate') {
      const angle = (n[0] ?? 0) * Math.PI / 180
      t = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle)]
    } else if (name === 'skewX') t = [1, 0, Math.tan((n[0] ?? 0) * Math.PI / 180), 1]
    else if (name === 'skewY') t = [1, Math.tan((n[0] ?? 0) * Math.PI / 180), 0, 1]
    ;[a, b, c, d] = [a * t[0]! + c * t[1]!, b * t[0]! + d * t[1]!, a * t[2]! + c * t[3]!, b * t[2]! + d * t[3]!]
  }
  const scale = Math.sqrt(Math.abs(a * d - b * c))
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function format(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

// Оставить только разрешённые атрибуты; из style — только mask-type (Figma пишет его так)
function sanitizeAttributes(node: XastElement) {
  const attributes = node.attributes
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'style') {
      delete attributes.style
      const maskType = /(?:^|;)\s*mask-type\s*:\s*(alpha|luminance)\s*(?:;|$)/i.exec(value)
      if (maskType && node.name === 'mask') attributes.style = `mask-type:${maskType[1]!.toLowerCase()}`
      continue
    }
    if (!ATTRIBUTES.has(key) || (/url\(/i.test(value) && !LOCAL_URL.test(value.trim()))) delete attributes[key]
  }
}

function isHidden(node: XastElement): boolean {
  const { display, visibility, opacity } = node.attributes
  return display === 'none' || visibility === 'hidden' || visibility === 'collapse' || number(opacity, 1) <= 0
}

function inheritPaint(parent: Paint, node: XastElement): Paint {
  const { attributes } = node
  return {
    fill: attributes.fill?.trim() ?? parent.fill,
    stroke: attributes.stroke?.trim() ?? parent.stroke,
    strokeWidth: number(attributes['stroke-width'], parent.strokeWidth),
    fillOpacity: number(attributes['fill-opacity'], parent.fillOpacity),
    strokeOpacity: number(attributes['stroke-opacity'], parent.strokeOpacity)
  }
}

function coversBox(node: XastElement, box: Box): boolean {
  const { attributes } = node
  const x = number(attributes.x, 0)
  const y = number(attributes.y, 0)
  const width = number(attributes.width, 0)
  const height = number(attributes.height, 0)
  const slackX = box.width * (1 - BACKGROUND_COVER)
  const slackY = box.height * (1 - BACKGROUND_COVER)
  return x <= box.x + slackX && y <= box.y + slackY
    && x + width >= box.x + box.width - slackX && y + height >= box.y + box.height - slackY
}

// Фигура рисунка: запомнить для перекраски. false — невидима, убрать
function collectShape(node: XastElement, parent: XastElement, paint: Paint, context: Context, state: State): boolean {
  const filled = node.name !== 'line' && hasPaint(paint.fill) && paint.fillOpacity > 0
  const stroked = hasPaint(paint.stroke) && paint.strokeOpacity > 0 && paint.strokeWidth > 0
  if (!filled && !stroked) return false
  state.shapes.push({ node, parent, paint, context, filled, stroked })
  if (state.shapes.length > MAX_SHAPES) fail(MESSAGES.complex)
  return true
}

// Трассированная картинка: ни одной обводки, все заливки серые и среди них есть тёмные (линии)
function isTraced(shapes: Shape[]): boolean {
  return shapes.every(shape => !shape.stroked && isGray(shape.paint.fill))
    && shapes.some(shape => isDark(shape.paint.fill))
}

function removeAttributes(node: XastElement, keys: readonly string[]) {
  for (const key of keys) delete node.attributes[key]
}

function clearPaint(node: XastElement) {
  removeAttributes(node, ['opacity', 'fill-opacity', 'stroke-opacity', 'display', 'visibility'])
}

// Трассированная картинка: заливка → чёрная (линия) или белая (бумага), без обводок
function binarizeShape({ node, paint }: Shape) {
  const color = parseColor(paint.fill)
  clearPaint(node)
  node.attributes.fill = color && paint.fillOpacity >= 0.5 && luma(color) < TRACE_LUMA ? '#000' : '#fff'
  node.attributes.stroke = 'none'
  delete node.attributes['stroke-width']
}

// Фигура → белая область с чёрной обводкой, тёмная заливка → чёрная линия. false — фигуру убрать
function outlineShape({ node, paint, context, filled, stroked }: Shape, state: State): boolean {
  if (node.name === 'rect' && !stroked && !context.transformed && coversBox(node, state.box)) return false
  const ink = filled && paint.fillOpacity >= 0.5 && isDark(paint.fill)

  const attributes = node.attributes
  clearPaint(node)
  attributes.fill = ink ? '#000' : filled ? '#fff' : 'none'
  if (stroked || !ink) {
    attributes.stroke = '#000'
    // Толщина — в своих единицах фигуры: минимум пересчитывается через масштаб предков
    attributes['stroke-width'] = format(stroked
      ? Math.max(paint.strokeWidth, state.minLine / context.scale)
      : state.defaultLine / context.scale)
    if (!stroked) attributes['stroke-linejoin'] = 'round'
  } else {
    attributes.stroke = 'none'
    delete attributes['stroke-width']
  }
  return true
}

// Перекрасить собранные фигуры; сколько осталось
function recolorShapes(state: State): number {
  if (isTraced(state.shapes)) {
    state.shapes.forEach(binarizeShape)
    return state.shapes.length
  }
  let kept = 0
  for (const shape of state.shapes) {
    if (outlineShape(shape, state)) kept += 1
    else shape.parent.children = shape.parent.children.filter(child => child !== shape.node)
  }
  return kept
}

function walk(parent: XastElement, context: Context, state: State) {
  parent.children = parent.children.filter((child) => {
    if (!isElement(child)) return false
    state.elements += 1
    if (state.elements > MAX_ELEMENTS) fail(MESSAGES.complex)
    return keepElement(child, parent, context, state)
  })
}

function keepElement(node: XastElement, parent: XastElement, context: Context, state: State): boolean {
  const { name } = node
  if (SKIPPED_CONTENT.has(name)) {
    state.skipped = true
    return false
  }
  if (!SHAPES.has(name) && !MASKS.has(name) && name !== 'g' && name !== 'defs') return false
  sanitizeAttributes(node)
  if (isHidden(node)) return false

  // Из defs нужны только маски и обрезки — градиенты и прочее после перекраски не используются
  if (name === 'defs') {
    node.children = node.children.filter(child => isElement(child) && MASKS.has(child.name))
    walk(node, { ...context, inMask: true }, state)
    return node.children.length > 0
  }

  const paint = inheritPaint(context.paint, node)
  if (MASKS.has(name)) {
    walk(node, { paint, transformed: true, scale: context.scale, inMask: true }, state)
    return true
  }

  const transform = node.attributes.transform
  const transformed = context.transformed || transform !== undefined
  const scale = transform ? context.scale * transformScale(transform) : context.scale
  if (name === 'g') {
    if (!context.inMask) {
      removeAttributes(node, ['opacity', 'fill-opacity', 'stroke-opacity'])
    }
    walk(node, { paint, transformed, scale, inMask: context.inMask }, state)
    return node.children.length > 0
  }

  return context.inMask || collectShape(node, parent, paint, { ...context, transformed, scale }, state)
}

function readBox(svg: XastElement): Box {
  const viewBox = svg.attributes.viewBox?.trim().split(/[\s,]+/).map(Number)
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2]! > 0 && viewBox[3]! > 0) {
    return { x: viewBox[0]!, y: viewBox[1]!, width: viewBox[2]!, height: viewBox[3]! }
  }
  const width = number(svg.attributes.width, 0)
  const height = number(svg.attributes.height, 0)
  if (width > 0 && height > 0) return { x: 0, y: 0, width, height }
  fail(MESSAGES.size)
}

function coloringPlugin(result: { width: number, height: number, notes: string[] }): CustomPlugin {
  return {
    name: 'coloringArt',
    fn: (root: XastRoot) => {
      const elements = root.children.filter(isElement)
      const svg = elements[0]
      if (elements.length !== 1 || svg?.name !== 'svg') fail(MESSAGES.notSvg)
      root.children = [svg]

      const box = readBox(svg)
      const ratio = box.width / box.height
      if (ratio > MAX_ASPECT || ratio < 1 / MAX_ASPECT) fail(MESSAGES.aspect)
      // Единиц viewBox на пиксель рабочего растра
      const unit = Math.max(box.width, box.height) / WORK_SIZE
      const state: State = { box, minLine: MIN_LINE * unit, defaultLine: DEFAULT_LINE * unit, elements: 0, shapes: [], skipped: false }

      sanitizeAttributes(svg)
      walk(svg, {
        paint: inheritPaint(DEFAULT_PAINT, svg),
        transformed: svg.attributes.transform !== undefined,
        scale: svg.attributes.transform ? transformScale(svg.attributes.transform) : 1,
        inMask: false
      }, state)
      if (recolorShapes(state) === 0) fail(state.skipped ? MESSAGES.onlySkipped : MESSAGES.empty)

      result.width = ratio >= 1 ? WORK_SIZE : Math.round(WORK_SIZE * ratio)
      result.height = ratio >= 1 ? Math.round(WORK_SIZE / ratio) : WORK_SIZE
      removeAttributes(svg, ['x', 'y', 'opacity', 'display', 'visibility'])
      Object.assign(svg.attributes, {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: [box.x, box.y, box.width, box.height].map(format).join(' '),
        width: String(result.width),
        height: String(result.height)
      })
      if (state.skipped) result.notes.push(MESSAGES.skipped)
      return null
    }
  }
}

export function prepareSvgArt(source: string): SvgArt {
  const text = source.replace(/^﻿/, '')
  if (Buffer.byteLength(text) > MAX_SVG_BYTES) fail(MESSAGES.tooBig)
  if (!/<svg[\s>]/.test(text)) fail(MESSAGES.notSvg)
  // Сущности DTD — путь к «бомбам» из вложенных подстановок; Figma их не пишет
  if (/<!ENTITY/i.test(text) || /<!DOCTYPE[^>]*\[/i.test(text)) fail(MESSAGES.entities)

  const result = { width: 0, height: 0, notes: [] as string[] }
  let svg: string
  try {
    svg = optimize(text, {
      plugins: [
        'removeDoctype',
        'removeXMLProcInst',
        'removeComments',
        'removeMetadata',
        // Стили из <style> и style="" → атрибуты: перекраска видит настоящие заливки и обводки
        { name: 'inlineStyles', params: { onlyMatchedOnce: false } },
        'convertStyleToAttrs',
        // Названия цветов и rgb() → #hex: тёмные заливки распознаются по одному формату
        { name: 'convertColors', params: { currentColor: false } },
        coloringPlugin(result),
        // mergePaths склеил бы перекрывающиеся фигуры — обводка нижней проступила бы сквозь верхнюю
        { name: 'preset-default', params: { overrides: { mergePaths: false } } }
      ]
    }).data
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    fail(MESSAGES.notSvg)
  }
  if (Buffer.byteLength(svg) > MAX_SVG_BYTES) fail(MESSAGES.tooBig)
  return { svg, ...result }
}
