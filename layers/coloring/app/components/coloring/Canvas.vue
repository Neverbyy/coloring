<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import type { GalleryArt } from '../../../shared/gallery'
import { paperGeometry, type HistoryOp } from '../../../shared/history'
import { ColoringEngine } from '../../engine/engine'
import { ColoringHistory } from '../../engine/history'
import { buildSegmentMap } from '../../engine/segmentation'
import { HistorySync, type SyncStatus } from '../../engine/sync'

const props = defineProps<{ art: GalleryArt }>()
const emit = defineEmits<{
  progress: [value: number]
  history: [canUndo: boolean, canRedo: boolean]
  status: [status: SyncStatus]
  // Рисунок только что стал закрашен на 100% действием игрока
  completed: []
}>()

// Удержание без движения столько — заливка (или очистка резинкой) всего сегмента
const HOLD_MS = 450
// Сдвиг пальца больше этого (CSS px) — это штрих, а не удержание
const HOLD_TOLERANCE = 10
// Картинки (миниатюра, PNG для камеры) готовим в паузе: сборка и кодирование нагружают
// браузер, и посреди рисования это заметно
const IMAGES_IDLE_MS = 1500
// Длинная сторона миниатюры для галереи. Миниатюра — вся бумага с полями (картинка в ней
// ~40% по высоте), так картинка на карточке выходит ~290px — с запасом на плотные экраны
const THUMBNAIL_SIZE = 720

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
// Кольцо удержания под пальцем (координаты внутри холста)
const hold = ref<{ x: number, y: number } | null>(null)

const ratio = computed(() => props.art.width / props.art.height)
// Бумага с полями вокруг картинки: на экране видна та её часть, что попадает в рамку
const paper = computed(() => paperGeometry(props.art.width, props.art.height))
const paperStyle = computed(() => paperLayout(props.art.width, props.art.height))
// Пока грузится состояние, на месте холста — миниатюра рисунка (она уже есть у браузера):
// рисунок виден сразу, а не белым
const placeholder = computed(() => previews.get(props.art.id)?.thumbnail ?? props.art.thumbnail)
const artRegion = computed(() => {
  const { art } = paper.value
  return { x: art.x, y: art.y, w: art.width, h: art.height }
})

let engine: ColoringEngine | null = null
let history: ColoringHistory | null = null
let sync: HistorySync | null = null
let pointerId: number | null = null
let holdStart: { clientX: number, clientY: number, x: number, y: number } | null = null
let holdTimer: ReturnType<typeof setTimeout> | undefined
// Положение холста на экране — замеряется в начале штриха, а не на каждое движение
let canvasRect: DOMRect | null = null
// Точки касания копятся и рисуются раз в кадр
let pendingPoints: number[] = []
let frame = 0
let lastProgress = 0
let version = 0
let exported: { version: number, image: Blob } | null = null
let imagesTimer: ReturnType<typeof setTimeout> | undefined
// Рисунок менялся игроком, а миниатюра ещё старая
let thumbnailStale = false

async function init() {
  failed.value = false
  sync?.dispose()
  sync = null
  try {
    // Состояние и база — параллельно; обычно уже в пути с нажатия на карточку галереи
    const drawingPromise = fetchDrawing(queryClient, props.art)
    const image = lineArt.value!
    await image.decode()

    // Разметка сегментов: картинка на белой бумаге. Поля бумаги соединяются с фоном картинки —
    // это один сегмент фона, его можно красить во всей рамке
    const { width, height, art } = paper.value
    const raster = document.createElement('canvas')
    raster.width = width
    raster.height = height
    const context = raster.getContext('2d', { willReadFrequently: true })!
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, art.x, art.y, art.width, art.height)
    const map = buildSegmentMap(context.getImageData(0, 0, width, height).data, width, height)

    engine = new ColoringEngine(map, paintCanvas.value!, previewCanvas.value!)
    const currentHistory = new ColoringHistory(engine, {
      createScratch: () => ColoringEngine.offscreen(map),
      onBase: (_seq, base) => sync?.baked(base)
    })
    history = currentHistory
    const currentSync = new HistorySync({
      artId: props.art.id,
      // v3 — координаты бумаги с полями, в хранилище только неотправленный хвост
      storageKey: `coloring:v3:${auth.user?.id ?? 'guest'}:${props.art.id}`,
      source: {
        baseSeq: () => currentHistory.baseSeq,
        baseImage: () => currentHistory.baseImage,
        ops: () => currentHistory.ops,
        cursor: () => currentHistory.cursor,
        progress: () => engine?.progress() ?? 0
      },
      onStatus: status => emit('status', status),
      onUnauthorized: () => {
        auth.forget()
        navigateTo('/login')
      }
    })
    sync = currentSync

    const { state, base } = await drawingPromise
    currentHistory.load(await currentSync.restore(state, base))
    await currentHistory.renderAt(currentHistory.cursor)
    if (import.meta.dev) (window as unknown as { __coloring?: unknown }).__coloring = { engine, history, map }
    ready.value = true
    // Рисунок начат, а миниатюры у галереи нет (сброшена или не дошла) — сделаем заново
    if (!props.art.thumbnail && currentHistory.head > 0) thumbnailStale = true
    report(false)
  } catch (error) {
    if (errorStatus(error) === 401) {
      auth.forget()
      await navigateTo('/login')
      return
    }
    failed.value = true
  }
}

// Сообщить странице прогресс и доступность отмены/повтора
function report(byPlayer: boolean) {
  if (!engine || !history) return
  const progress = engine.progress()
  emit('progress', progress)
  emit('history', history.canUndo, history.canRedo)
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

// В паузе: миниатюра для галереи и (на телефоне) картинка для «камеры». На телефоне её нужно
// иметь заранее — Safari не даёт открыть «Поделиться» после долгого ожидания внутри нажатия.
// На компьютере файл скачивается, и картинка собирается по нажатию
function prepareImages() {
  if (engine?.drawing) return
  if (window.matchMedia('(pointer: coarse)').matches) exportImage().catch(() => {})
  if (!thumbnailStale) return
  updateThumbnail().then((image) => {
    if (image) sync?.queueThumbnail(image)
  }).catch(() => {})
}

// Миниатюра сразу попадает в галерею этой вкладки, на сервер — вместе с автосохранением
async function updateThumbnail(): Promise<Blob | null> {
  if (!engine || !lineArt.value) return null
  thumbnailStale = false
  const progress = engine.progress()
  const image = await engine.thumbnail(lineArt.value, artRegion.value, THUMBNAIL_SIZE)
  previews.set(props.art.id, image, progress)
  return image
}

function commit(op: HistoryOp) {
  if (!history || !sync) return
  const truncatedTo = history.canRedo ? history.cursor : undefined
  history.push(op)
  sync.changed(truncatedTo)
  report(true)
}

function toWork(event: PointerEvent): [number, number] {
  const rect = canvasRect ?? paintCanvas.value!.getBoundingClientRect()
  return [
    (event.clientX - rect.left) / rect.width * engine!.width,
    (event.clientY - rect.top) / rect.height * engine!.height
  ]
}

function onPointerDown(event: PointerEvent) {
  if (!ready.value || busy.value || !engine || pointerId !== null) return
  if (!event.isPrimary || event.button !== 0) return
  canvasRect = paintCanvas.value!.getBoundingClientRect()
  const [x, y] = toWork(event)
  if (!engine.beginStroke(tools.tool, tools.color, x, y)) return

  pointerId = event.pointerId
  stage.value!.setPointerCapture(pointerId)
  const rect = stage.value!.getBoundingClientRect()
  holdStart = { clientX: event.clientX, clientY: event.clientY, x, y }
  hold.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  holdTimer = setTimeout(fillByHold, HOLD_MS)
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== pointerId || !engine?.drawing) return
  // Промежуточные точки (getCoalescedEvents) — для гладкой линии; рисуем их раз в кадр
  const coalesced = event.getCoalescedEvents?.() ?? []
  for (const point of coalesced.length ? coalesced : [event]) pendingPoints.push(...toWork(point))
  if (!frame) frame = requestAnimationFrame(drawPending)

  if (holdStart && Math.hypot(event.clientX - holdStart.clientX, event.clientY - holdStart.clientY) > HOLD_TOLERANCE) {
    cancelHold()
  }
}

function drawPending() {
  cancelAnimationFrame(frame)
  frame = 0
  if (!pendingPoints.length) return
  engine?.extendStroke(pendingPoints)
  pendingPoints = []
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) return
  pointerId = null
  canvasRect = null
  cancelHold()
  drawPending()
  const op = engine?.endStroke()
  if (op) commit(op)
}

function cancelHold() {
  clearTimeout(holdTimer)
  holdStart = null
  hold.value = null
}

// Палец держат на месте: весь сегмент заливается цветом (резинка — очищает).
// Движение до отпускания пальца после этого не рисует
function fillByHold() {
  const start = holdStart
  cancelHold()
  if (!engine?.drawing || !start) return
  pendingPoints = []
  const point: [number, number] = [Math.round(start.x), Math.round(start.y)]
  const op: HistoryOp = tools.tool === 'eraser'
    ? { t: 'clear', p: point }
    : { t: 'fill', c: tools.color, p: point }
  engine.cancelStroke()
  engine.apply(op)
  commit(op)
}

async function undo() {
  if (!ready.value || busy.value || !history?.canUndo || engine?.drawing) return
  busy.value = true
  try {
    await history.undo()
    sync?.changed()
    report(true)
  } finally {
    busy.value = false
  }
}

function redo() {
  if (!ready.value || busy.value || !history?.canRedo || engine?.drawing) return
  history.redo()
  sync?.changed()
  report(true)
}

// PNG результата без интерфейса; готовый берём из кэша, если рисунок с тех пор не менялся
async function exportImage(): Promise<Blob> {
  if (!engine || !lineArt.value) throw new Error('Рисунок ещё не загружен')
  if (exported?.version === version) return exported.image
  const current = version
  const image = await engine.exportImage(lineArt.value, artRegion.value)
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
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(holdTimer)
  clearTimeout(imagesTimer)
  cancelAnimationFrame(frame)
  forgetDrawing(queryClient, props.art.id)
  // Ушли сразу после штриха — миниатюра ещё старая: делаем последнюю и отдаём на отправку
  sync?.dispose(thumbnailStale ? updateThumbnail() : undefined)
})

defineExpose({ undo, redo, exportImage })
</script>

<template>
  <div
    ref="stage"
    class="art-canvas"
    :style="{ '--ratio': ratio }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @lostpointercapture="onPointerUp"
  >
    <!-- Бумага выходит за картинку во все стороны; лишнее обрезает рамка -->
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
    <!-- Контур поверх краски: multiply делает белое прозрачным, линии остаются чёткими -->
    <img ref="lineArt" class="art-canvas__lines" :src="art.image" :alt="art.title" draggable="false">
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
// Размер — как у картинки, вписанной в рамку (родитель — контейнер размеров)
.art-canvas {
  position: relative;
  width: min(100cqw, calc(100cqh * var(--ratio)));
  aspect-ratio: var(--ratio);
  touch-action: none;
}

.art-canvas__paper {
  position: absolute;
}

// Миниатюра-заглушка гаснет, когда холст готов: под ней уже то же самое, без скачка
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

// Кольцо удержания: успевает замкнуться ровно к заливке
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
