<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import type { GalleryArt } from '#layers/coloring/shared/gallery'
import { paperGeometry, type HistoryOp, type StrokeTool } from '#layers/coloring/shared/history'
import { COLORING_SOUNDS } from '#layers/coloring/shared/sounds'
import { DrawingSession } from '#layers/coloring/app/engine/session'
import { pendingStorageKey, type SyncStatus } from '#layers/coloring/app/engine/sync'
import type { CanvasView } from '#layers/coloring/app/utils/zoom'

const props = defineProps<{ art: GalleryArt, zoomMode?: 'in' | 'out' | 'free' | null }>()
const emit = defineEmits<{
  progress: [value: number]
  history: [canUndo: boolean, canRedo: boolean]
  status: [status: SyncStatus]
  completed: []
}>()

const HOLD_MS = 450
const HOLD_TOLERANCE = 10
const IMAGES_IDLE_MS = 1500
const STROKE_SOUND_IDLE_MS = 150
const THUMBNAIL_SIZE = 720
const TAP_SLOP = 8

const tools = useColoringToolsStore()
const auth = useAuthStore()
const previews = useDrawingPreviews()
const queryClient = useQueryClient()

const stage = ref<HTMLElement | null>(null)
const paintCanvas = ref<HTMLCanvasElement | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const lineArt = ref<HTMLImageElement | null>(null)

const ready = ref(false)
const failed = ref(false)
const busy = ref(false)
const hold = ref<{ x: number, y: number } | null>(null)
const view = ref<CanvasView>({ ...INITIAL_VIEW })
const panning = ref(false)

const ratio = computed(() => props.art.width / props.art.height)
const viewStyle = computed(() => ({
  transform: `translate(${view.value.x * 100}%, ${view.value.y * 100}%) scale(${view.value.scale})`
}))
const paper = computed(() => paperGeometry(props.art.width, props.art.height))
const paperStyle = computed(() => paperLayout(props.art.width, props.art.height))
const placeholder = computed(() => previews.get(props.art.id)?.thumbnail ?? props.art.thumbnail)
const artRegion = computed(() => {
  const { art } = paper.value
  return { x: art.x, y: art.y, w: art.width, h: art.height }
})

let session: DrawingSession | null = null
let pointerId: number | null = null
let holdStart: { clientX: number, clientY: number, x: number, y: number } | null = null
let holdTimer: ReturnType<typeof setTimeout> | undefined
let canvasRect: DOMRect | null = null
let pendingPoints: number[] = []
let frame = 0
let lastProgress = 0
let version = 0
let exported: { version: number, image: Blob } | null = null
let imagesTimer: ReturnType<typeof setTimeout> | undefined
let thumbnailStale = false
let strokeTool: StrokeTool = 'brush'
let strokeSound: LoopHandle | null = null
let strokeSoundTimer: ReturnType<typeof setTimeout> | undefined
let zoomGesture: { id: number, startX: number, startY: number, lastX: number, lastY: number, moved: boolean } | null = null
const fingers = new Map<number, { x: number, y: number }>()
let pinch: { distance: number, x: number, y: number, view: CanvasView } | null = null
let panAnchor: { x: number, y: number } | null = null

async function init() {
  failed.value = false
  session?.dispose()
  session = null
  try {
    const drawingPromise = fetchDrawing(queryClient, props.art)
    const image = lineArt.value!
    await image.decode()
    const map = segmentArt(image, paper.value)

    const current = new DrawingSession({
      artId: props.art.id,
      storageKey: pendingStorageKey(auth.user?.id ?? 'guest', props.art.id),
      map,
      paintCanvas: paintCanvas.value!,
      previewCanvas: previewCanvas.value!,
      onChange: report,
      onStatus: status => emit('status', status),
      onUnauthorized: () => auth.expire()
    })
    session = current

    const { state, base } = await drawingPromise
    await current.load(state, base)
    ready.value = true
    if (!props.art.thumbnail && current.history.head > 0) thumbnailStale = true
  } catch (error) {
    if (errorStatus(error) === 401) {
      await auth.expire()
      return
    }
    failed.value = true
  }
}

function report(byPlayer: boolean) {
  if (!session) return
  const progress = session.progress
  emit('progress', progress)
  emit('history', session.canUndo, session.canRedo)
  if (byPlayer && lastProgress < 100 && progress >= 100) emit('completed')
  lastProgress = progress
  version++
  if (byPlayer) thumbnailStale = true
  clearTimeout(imagesTimer)
  imagesTimer = setTimeout(() => whenIdle(prepareImages), IMAGES_IDLE_MS)
}

function whenIdle(task: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 1000 })
  else task()
}

function prepareImages() {
  if (session?.engine.drawing) return
  if (isTouchDevice()) exportImage().catch(() => {})
  if (!thumbnailStale) return
  updateThumbnail().then((image) => {
    if (image) session?.queueThumbnail(image)
  }).catch(() => {})
}

async function updateThumbnail(): Promise<Blob | null> {
  if (!session || !lineArt.value) return null
  thumbnailStale = false
  const progress = session.progress
  const image = await session.engine.thumbnail(lineArt.value, artRegion.value, THUMBNAIL_SIZE)
  previews.set(props.art.id, image, progress)
  return image
}

function toWork(event: PointerEvent): [number, number] {
  const engine = session!.engine
  const rect = canvasRect ?? paintCanvas.value!.getBoundingClientRect()
  return [
    (event.clientX - rect.left) / rect.width * engine.width,
    (event.clientY - rect.top) / rect.height * engine.height
  ]
}

function startZoomGesture(event: PointerEvent) {
  if (zoomGesture || !event.isPrimary || event.button !== 0) return
  zoomGesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false }
  stage.value!.setPointerCapture(event.pointerId)
}

function moveZoomGesture(event: PointerEvent) {
  const gesture = zoomGesture
  if (!gesture || event.pointerId !== gesture.id) return
  if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) <= TAP_SLOP) return
  gesture.moved = true
  panning.value = true
  const { offsetWidth, offsetHeight } = stage.value!
  view.value = panBy(view.value, (event.clientX - gesture.lastX) / offsetWidth, (event.clientY - gesture.lastY) / offsetHeight)
  gesture.lastX = event.clientX
  gesture.lastY = event.clientY
}

function endZoomGesture(event: PointerEvent) {
  const gesture = zoomGesture
  if (!gesture || event.pointerId !== gesture.id) return
  zoomGesture = null
  panning.value = false
  if (gesture.moved || event.type !== 'pointerup' || !props.zoomMode) return
  const rect = stage.value!.getBoundingClientRect()
  view.value = zoomAt(
    view.value,
    props.zoomMode === 'in' ? 1 : -1,
    (event.clientX - rect.left) / rect.width - 0.5,
    (event.clientY - rect.top) / rect.height - 0.5
  )
}

function stagePoint(clientX: number, clientY: number) {
  const rect = stage.value!.getBoundingClientRect()
  return { x: (clientX - rect.left) / rect.width - 0.5, y: (clientY - rect.top) / rect.height - 0.5 }
}

function pinchFingers() {
  const [a, b] = [...fingers.values()]
  if (!a || !b) return null
  return { distance: Math.hypot(a.x - b.x, a.y - b.y), ...stagePoint((a.x + b.x) / 2, (a.y + b.y) / 2) }
}

function regroupFingers() {
  const pair = pinchFingers()
  pinch = pair && { ...pair, view: { ...view.value } }
  const [single] = fingers.values()
  panAnchor = !pair && single ? { ...single } : null
  panning.value = fingers.size > 0
}

function startFreeGesture(event: PointerEvent) {
  fingers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  stage.value!.setPointerCapture(event.pointerId)
  regroupFingers()
}

function moveFreeGesture(event: PointerEvent) {
  fingers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  const pair = pinchFingers()
  if (pinch && pair) {
    const ratio = pinch.distance > 0 ? pair.distance / pinch.distance : 1
    view.value = pinchView(pinch.view, ratio, pinch.x, pinch.y, pair.x, pair.y)
    return
  }
  if (!panAnchor) return
  const { offsetWidth, offsetHeight } = stage.value!
  view.value = panBy(view.value, (event.clientX - panAnchor.x) / offsetWidth, (event.clientY - panAnchor.y) / offsetHeight)
  panAnchor = { x: event.clientX, y: event.clientY }
}

function endFreeGesture(event: PointerEvent) {
  fingers.delete(event.pointerId)
  regroupFingers()
}

function onPointerDown(event: PointerEvent) {
  if (props.zoomMode === 'free') {
    startFreeGesture(event)
    return
  }
  if (props.zoomMode) {
    startZoomGesture(event)
    return
  }
  if (!ready.value || busy.value || !session || pointerId !== null) return
  if (!event.isPrimary || event.button !== 0) return
  canvasRect = paintCanvas.value!.getBoundingClientRect()
  const [x, y] = toWork(event)
  if (!session.engine.beginStroke(tools.tool, tools.color, x, y)) return

  strokeTool = tools.tool
  pointerId = event.pointerId
  stage.value!.setPointerCapture(pointerId)
  const rect = stage.value!.getBoundingClientRect()
  holdStart = { clientX: event.clientX, clientY: event.clientY, x, y }
  hold.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  holdTimer = setTimeout(fillByHold, HOLD_MS)
}

function onPointerMove(event: PointerEvent) {
  if (fingers.has(event.pointerId)) {
    moveFreeGesture(event)
    return
  }
  if (zoomGesture) {
    moveZoomGesture(event)
    return
  }
  if (event.pointerId !== pointerId || !session?.engine.drawing) return
  const coalesced = event.getCoalescedEvents?.() ?? []
  for (const point of coalesced.length ? coalesced : [event]) pendingPoints.push(...toWork(point))
  if (!frame) frame = requestAnimationFrame(onFrame)

  if (holdStart && Math.hypot(event.clientX - holdStart.clientX, event.clientY - holdStart.clientY) > HOLD_TOLERANCE) {
    cancelHold()
  }
}

function onFrame() {
  frame = 0
  if (drawPending() && session?.engine.drawing) strokeMoved()
}

function drawPending(): boolean {
  cancelAnimationFrame(frame)
  frame = 0
  if (!pendingPoints.length) return false
  session?.engine.extendStroke(pendingPoints)
  pendingPoints = []
  return true
}

function strokeMoved() {
  strokeSound ??= loopSound(COLORING_SOUNDS[strokeTool])
  clearTimeout(strokeSoundTimer)
  strokeSoundTimer = setTimeout(stopStrokeSound, STROKE_SOUND_IDLE_MS)
}

function stopStrokeSound() {
  clearTimeout(strokeSoundTimer)
  strokeSound?.stop()
  strokeSound = null
}

function onPointerUp(event: PointerEvent) {
  if (fingers.has(event.pointerId)) {
    endFreeGesture(event)
    return
  }
  if (zoomGesture) {
    endZoomGesture(event)
    return
  }
  if (event.pointerId !== pointerId) return
  pointerId = null
  canvasRect = null
  cancelHold()
  stopStrokeSound()
  drawPending()
  const op = session?.engine.endStroke()
  if (op) session!.commit(op)
}

function cancelHold() {
  clearTimeout(holdTimer)
  holdStart = null
  hold.value = null
}

function fillByHold() {
  const start = holdStart
  cancelHold()
  if (!session?.engine.drawing || !start) return
  stopStrokeSound()
  pendingPoints = []
  const point: [number, number] = [Math.round(start.x), Math.round(start.y)]
  const op: HistoryOp = tools.tool === 'eraser'
    ? { t: 'clear', p: point }
    : { t: 'fill', tool: tools.tool, c: tools.color, p: point }
  session.engine.cancelStroke()
  if (op.t === 'clear' && !session.engine.hasPaint(point[0], point[1])) return
  session.engine.apply(op)
  session.commit(op)
}

function canEditHistory(): boolean {
  return ready.value && !busy.value && !!session && !session.engine.drawing
}

async function undo() {
  if (!canEditHistory() || !session!.canUndo) return
  busy.value = true
  try {
    await session!.undo()
  } finally {
    busy.value = false
  }
}

function redo() {
  if (canEditHistory()) session!.redo()
}

function clearAll() {
  if (!canEditHistory() || !session!.engine.hasAnyPaint()) return
  const op: HistoryOp = { t: 'reset' }
  session!.engine.apply(op)
  session!.commit(op)
}

async function exportImage(): Promise<Blob> {
  if (!session || !lineArt.value) throw new Error('Рисунок ещё не загружен')
  if (exported?.version === version) return exported.image
  const current = version
  const image = await session.engine.exportImage(lineArt.value, artRegion.value)
  exported = { version: current, image }
  return image
}

function onKeydown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault()
    undo()
  } else if ((key === 'z' && event.shiftKey) || key === 'y') {
    event.preventDefault()
    redo()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  init()
  whenIdle(() => preloadSounds(Object.values(COLORING_SOUNDS)))
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(holdTimer)
  clearTimeout(imagesTimer)
  cancelAnimationFrame(frame)
  stopStrokeSound()
  forgetDrawing(queryClient, props.art.id)
  session?.dispose(thumbnailStale ? updateThumbnail() : undefined)
})

defineExpose({ undo, redo, exportImage, clearAll })
</script>

<template>
  <div
    ref="stage"
    class="art-canvas"
    :class="{
      'art-canvas--zoom-in': zoomMode === 'in',
      'art-canvas--zoom-out': zoomMode === 'out',
      'art-canvas--grab': zoomMode === 'free',
      'art-canvas--panning': panning
    }"
    :style="{ '--ratio': ratio }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @lostpointercapture="onPointerUp"
  >
    <div class="art-canvas__view" :style="viewStyle">
      <div class="art-canvas__paper" :style="paperStyle">
        <Transition name="art-canvas-placeholder">
          <img
            v-if="placeholder && !ready"
            class="art-canvas__layer art-canvas__placeholder"
            :src="placeholder"
            alt=""
            draggable="false"
          >
        </Transition>
        <canvas ref="paintCanvas" class="art-canvas__layer" />
        <canvas ref="previewCanvas" class="art-canvas__layer" />
      </div>
      <img ref="lineArt" class="art-canvas__lines" :src="art.image" :alt="art.title" draggable="false">
    </div>
    <span
      v-if="hold"
      class="art-canvas__hold"
      :style="{ left: `${hold.x}px`, top: `${hold.y}px`, '--hold-color': tools.tool === 'eraser' ? '#a6a6a6' : tools.color }"
      aria-hidden="true"
    />
    <div v-if="failed" class="art-canvas__error">
      <p>Не получилось загрузить рисунок</p>
      <button type="button" @click="init">Попробовать ещё раз</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.art-canvas {
  position: relative;
  width: min(100cqw, calc(100cqh * var(--ratio)));
  aspect-ratio: var(--ratio);
  touch-action: none;
}

.art-canvas--zoom-in {
  cursor: zoom-in;
}

.art-canvas--zoom-out {
  cursor: zoom-out;
}

.art-canvas--grab {
  cursor: grab;
}

.art-canvas--panning {
  cursor: grabbing;
}

.art-canvas__view {
  position: absolute;
  inset: 0;
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.art-canvas--panning .art-canvas__view {
  transition: none;
}

.art-canvas__paper {
  position: absolute;
}

.art-canvas-placeholder-leave-active {
  transition: opacity 0.15s;
}

.art-canvas-placeholder-leave-to {
  opacity: 0;
}

.art-canvas__layer,
.art-canvas__lines {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.art-canvas__lines {
  mix-blend-mode: multiply;
  pointer-events: none;
}

.art-canvas__hold {
  position: absolute;
  width: 72px;
  height: 72px;
  margin: -36px 0 0 -36px;
  border: 6px solid var(--hold-color);
  border-radius: 50%;
  box-shadow: 0 0 0 3px #fff;
  pointer-events: none;
  animation: art-canvas-hold 0.45s linear forwards;
}

.art-canvas__error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(#fff, 0.9);
  color: $color-ink;
  font-size: 18px;
  font-weight: 500;
  text-align: center;

  button {
    padding: 12px 20px;
    border-radius: 16px;
    background: $color-accent;
    color: #fff;
    font-weight: 700;
  }
}

@keyframes art-canvas-hold {
  from {
    opacity: 0.4;
    transform: scale(1.6);
  }

  to {
    opacity: 1;
    transform: scale(0.6);
  }
}
</style>
