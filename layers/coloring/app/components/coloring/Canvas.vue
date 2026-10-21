<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import type { GalleryArt } from '../../../shared/gallery'
import { paperGeometry, type HistoryOp, type StrokeTool } from '../../../shared/history'
import { COLORING_SOUNDS } from '../../../shared/sounds'
import { DrawingSession } from '../../engine/session'
import { pendingStorageKey, type SyncStatus } from '../../engine/sync'

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
// Звук инструмента — только пока им водят по холсту: столько без движения — тишина
const STROKE_SOUND_IDLE_MS = 150
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

let session: DrawingSession | null = null
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
// Инструмент текущего штриха и его звук
let strokeTool: StrokeTool = 'brush'
let strokeSound: LoopHandle | null = null
let strokeSoundTimer: ReturnType<typeof setTimeout> | undefined

async function init() {
  failed.value = false
  session?.dispose()
  session = null
  try {
    // Состояние и база — параллельно; обычно уже в пути с нажатия на карточку галереи
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
    if (import.meta.dev) {
      // Для проверок Playwright; segment — повторная разметка (замер времени)
      (window as unknown as { __coloring?: unknown }).__coloring = {
        engine: current.engine,
        history: current.history,
        map,
        segment: () => segmentArt(image, paper.value)
      }
    }
    ready.value = true
    // Рисунок начат, а миниатюры у галереи нет (сброшена или не дошла) — сделаем заново
    if (!props.art.thumbnail && current.history.head > 0) thumbnailStale = true
  } catch (error) {
    if (errorStatus(error) === 401) {
      await auth.expire()
      return
    }
    failed.value = true
  }
}

// Сообщить странице прогресс и доступность отмены/повтора; в паузе — обновить картинки
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

// В паузе: миниатюра для галереи и (на телефоне) картинка для «камеры». На телефоне её нужно
// иметь заранее — Safari не даёт открыть «Поделиться» после долгого ожидания внутри нажатия.
// На компьютере файл скачивается, и картинка собирается по нажатию
function prepareImages() {
  if (session?.engine.drawing) return
  if (isTouchDevice()) exportImage().catch(() => {})
  if (!thumbnailStale) return
  updateThumbnail().then((image) => {
    if (image) session?.queueThumbnail(image)
  }).catch(() => {})
}

// Миниатюра сразу попадает в галерею этой вкладки, на сервер — вместе с автосохранением
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

function onPointerDown(event: PointerEvent) {
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
  if (event.pointerId !== pointerId || !session?.engine.drawing) return
  // Промежуточные точки (getCoalescedEvents) — для гладкой линии; рисуем их раз в кадр
  const coalesced = event.getCoalescedEvents?.() ?? []
  for (const point of coalesced.length ? coalesced : [event]) pendingPoints.push(...toWork(point))
  if (!frame) frame = requestAnimationFrame(onFrame)

  if (holdStart && Math.hypot(event.clientX - holdStart.clientX, event.clientY - holdStart.clientY) > HOLD_TOLERANCE) {
    cancelHold()
  }
}

// Кадр: нарисовать накопленные точки; штрих двигается — звучит его инструмент
function onFrame() {
  frame = 0
  if (drawPending() && session?.engine.drawing) strokeMoved()
}

// false — рисовать было нечего
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

// Палец держат на месте: весь сегмент заливается цветом (резинка — очищает).
// Движение до отпускания пальца после этого не рисует
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
  session.engine.apply(op)
  session.commit(op)
}

// Отмена и повтор — не посреди штриха и не пока идёт предыдущая отмена
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

// PNG результата без интерфейса; готовый берём из кэша, если рисунок с тех пор не менялся
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
  // Звуки рисования и успеха — заранее, в простое (у карандаша 1.5 МБ)
  whenIdle(() => preloadSounds(Object.values(COLORING_SOUNDS)))
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(holdTimer)
  clearTimeout(imagesTimer)
  cancelAnimationFrame(frame)
  stopStrokeSound()
  forgetDrawing(queryClient, props.art.id)
  // Ушли сразу после штриха — миниатюра ещё старая: делаем последнюю и отдаём на отправку
  session?.dispose(thumbnailStale ? updateThumbnail() : undefined)
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
