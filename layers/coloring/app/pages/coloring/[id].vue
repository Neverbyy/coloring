<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { artApiPath } from '#layers/coloring/shared/gallery'
import { COLORING_SOUNDS } from '#layers/coloring/shared/sounds'
import type { SyncStatus } from '#layers/coloring/app/engine/sync'

const route = useRoute()
const tools = useColoringToolsStore()
const queryClient = useQueryClient()

const id = computed(() => String(route.params.id))
const { data: art, error, suspense } = useArtQuery(id)
if (import.meta.server || !art.value) await suspense().catch(() => undefined)

if (error.value) {
  const statusCode = errorStatus(error.value) ?? 500
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? 'Раскраска не найдена' : 'Не удалось загрузить раскраску',
    fatal: true
  })
}

useHead({ title: () => `${art.value?.title ?? 'Раскраска'} — Раскраска` })

const canvas = useTemplateRef('canvas')

const liveProgress = ref<number | null>(null)
const progress = computed(() => liveProgress.value ?? art.value?.progress ?? 0)
const percent = computed(() => Math.floor(progress.value))

const canUndo = ref(false)
const canRedo = ref(false)
const syncStatus = ref<SyncStatus>('saved')

const shaking = ref(false)
const celebrating = ref(false)
const flashing = ref(false)
let celebrateTimer: ReturnType<typeof setTimeout> | undefined

function onHistory(undo: boolean, redo: boolean) {
  canUndo.value = undo
  canRedo.value = redo
}

const SUCCESS_DUCK = 0.3
const SUCCESS_DUCK_S = 2.2

function onCompleted() {
  playSound(COLORING_SOUNDS.success)
  duckMusic(SUCCESS_DUCK, SUCCESS_DUCK_S)
  shaking.value = true
  celebrating.value = true
  clearTimeout(celebrateTimer)
  celebrateTimer = setTimeout(() => { celebrating.value = false }, 2600)
}

async function onCamera() {
  if (!canvas.value || !art.value) return
  flashing.value = true
  try {
    await shareImage(await canvas.value.exportImage(), art.value.title)
  } catch {}
}

onMounted(() => {
  $fetch(artApiPath(id.value, '/open'), { method: 'POST' }).catch(() => {})
  markArtSeen(queryClient, id.value)
})

onBeforeUnmount(() => {
  clearTimeout(celebrateTimer)
  invalidateArt(queryClient, id.value)
})
</script>

<template>
  <main v-if="art" class="art-screen">
    <div class="board" :class="{ 'board--shake': shaking }" @animationend.self="shaking = false">
      <div class="board__left">
        <NuxtLink class="board__home" to="/coloring" aria-label="В галерею">
          <img src="../../assets/icons/home.svg" alt="" width="64" height="60">
        </NuxtLink>
        <button
          type="button"
          class="board__camera"
          :class="{ 'board__camera--hint': percent >= 100 }"
          aria-label="Сохранить или поделиться картинкой"
          @click="onCamera"
        >
          <img src="../../assets/icons/camera.svg" alt="" width="64" height="65">
        </button>
      </div>

      <section class="frame" aria-label="Рисунок">
        <div class="frame__art" @pointerdown="tools.closePalette()">
          <ColoringCanvas
            ref="canvas"
            :art="art"
            @progress="liveProgress = $event"
            @history="onHistory"
            @status="syncStatus = $event"
            @completed="onCompleted"
          />
        </div>

        <p class="frame__progress" :class="{ 'frame__progress--done': percent >= 100 }" aria-live="polite">
          {{ percent }}%
        </p>

        <p v-if="syncStatus === 'offline'" class="frame__status" role="status">
          Нет связи — сохраним позже
        </p>

        <Transition name="frame-done">
          <p v-if="celebrating" class="frame__done" role="status">Готово!</p>
        </Transition>

        <span v-if="flashing" class="frame__flash" aria-hidden="true" @animationend="flashing = false" />

        <div class="frame__history">
          <button
            type="button"
            class="frame__history-button"
            :disabled="!canUndo"
            aria-label="Отменить"
            @click="canvas?.undo()"
          >
            <ColoringUndoIcon />
          </button>
          <button
            type="button"
            class="frame__history-button frame__history-button--redo"
            :disabled="!canRedo"
            aria-label="Повторить"
            @click="canvas?.redo()"
          >
            <ColoringUndoIcon />
          </button>
        </div>

        <ColoringProgressFrame :progress="progress" />
      </section>

      <div class="board__right">
        <ColoringSidePanel />
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
$column-width: 90px;

.art-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-board;

  @include desktop {
    padding: 20px;
    background: $color-sky;
  }
}

$frame-max-aspect: 1.6;
$frame-min-aspect: 0.5;
$board-chrome-x: 2 * $column-width + 2 * $frame-border;

.board {
  display: flex;
  width: 100%;
  height: 100%;
  max-width: min(1280px, calc(#{$frame-max-aspect} * (100dvh - 120px) + #{$board-chrome-x}));
  max-height: min(920px, calc((100vw - #{$board-chrome-x}) / #{$frame-min-aspect} + 108px));
  padding-top: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  background: $color-board;

  @include desktop {
    max-width: min(1280px, calc(#{$frame-max-aspect} * (min(920px, 100dvh - 40px) - 138.58px) + #{$board-chrome-x}));
    max-height: min(920px, calc((min(1280px, 100vw - 40px) - #{$board-chrome-x}) / #{$frame-min-aspect} + 108px));
    overflow: hidden;
    border-radius: $frame-radius;
  }

  @include phone-portrait {
    flex-direction: column;
    gap: 12px;
    max-width: none;
    max-height: none;
    padding: max(12px, env(safe-area-inset-top)) 12px 0;
  }
}

.board--shake {
  animation: board-shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes board-shake {
  10%,
  90% {
    transform: translate(-2px, 1px) rotate(-0.3deg);
  }

  20%,
  80% {
    transform: translate(4px, -2px) rotate(0.5deg);
  }

  30%,
  50%,
  70% {
    transform: translate(-6px, 2px) rotate(-0.7deg);
  }

  40%,
  60% {
    transform: translate(6px, -1px) rotate(0.7deg);
  }
}

.board__left {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: $column-width;
  padding-top: 16px;

  @include phone-portrait {
    flex-direction: row;
    width: auto;
    padding: 0 4px;
  }
}

.board__home,
.board__camera {
  display: block;
  transition: transform 0.1s;

  &:active {
    transform: scale(0.9);
  }

  img {
    display: block;
  }
}

.board__camera {
  display: grid;
  place-items: center;
  width: 79px;
  height: 80px;

  img {
    transform: rotate(-15deg);
  }
}

.board__camera--hint img {
  animation: camera-hint 1.6s ease-in-out infinite;
}

@keyframes camera-hint {
  0%,
  60%,
  100% {
    transform: rotate(-15deg) scale(1);
  }

  70% {
    transform: rotate(-5deg) scale(1.12);
  }

  80% {
    transform: rotate(-25deg) scale(1.12);
  }

  90% {
    transform: rotate(-15deg) scale(1);
  }
}

.board__right {
  flex: none;
  width: calc(#{$column-width} + env(safe-area-inset-right));

  @include phone-portrait {
    width: auto;
    height: calc(#{$column-width} + env(safe-area-inset-bottom));
  }
}

.frame {
  --history-size: 55.94px;

  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  @include frame-card;

  @include desktop {
    --history-size: 74.58px;
  }

  @media (max-height: 360px) {
    --history-size: 44px;
  }

  @include phone-portrait {
    min-height: 0;
  }
}

.frame__art {
  container-type: size;
  display: grid;
  flex: 1;
  place-items: center;
  min-height: 0;
  padding-bottom: var(--history-size);
  overflow: hidden;
  border-radius: $frame-radius - $frame-border;
  touch-action: none;
}

.frame__status {
  position: absolute;
  top: 24px;
  left: 24px;
  max-width: calc(100% - 140px);
  padding: 6px 12px;
  border-radius: 12px;
  background: #fff4d6;
  color: $color-ink;
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
}

.frame__done {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: $font-display;
  font-size: 64px;
  color: $color-accent;
  text-shadow: 0 0 0 #fff, 4px 4px 0 #fff, -4px -4px 0 #fff, 4px -4px 0 #fff, -4px 4px 0 #fff;
  pointer-events: none;
}

.frame-done-enter-active {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s;
}

.frame-done-leave-active {
  transition: opacity 0.3s;
}

.frame-done-enter-from {
  opacity: 0;
  transform: scale(0.4);
}

.frame-done-leave-to {
  opacity: 0;
}

.frame__flash {
  position: absolute;
  inset: 0;
  border-radius: $frame-radius - $frame-border;
  background: #fff;
  pointer-events: none;
  animation: frame-flash 0.35s ease-out forwards;
}

@keyframes frame-flash {
  from {
    opacity: 0.9;
  }

  to {
    opacity: 0;
  }
}

.frame__progress {
  position: absolute;
  top: 26px;
  right: 29px;
  font-family: $font-display;
  font-size: 32px;
  line-height: 32px;
  letter-spacing: 0.2px;
  color: #000;
  text-shadow:
    3px 0 #fff,
    -3px 0 #fff,
    0 3px #fff,
    0 -3px #fff,
    2px 2px #fff,
    -2px 2px #fff,
    2px -2px #fff,
    -2px -2px #fff;
  pointer-events: none;
  transition: color 0.3s;
}

.frame__progress--done {
  color: $color-accent;
}

.frame__history {
  position: absolute;
  bottom: 0;
  left: 50%;
  display: flex;
  gap: 24px;
  padding: 0 24px;
  border-radius: 24px 24px 0 0;
  background: $color-frame;
  transform: translateX(-50%);
}

.frame__history-button {
  width: var(--history-size);
  height: var(--history-size);
  color: #000;
  transition: transform 0.1s, color 0.2s;

  &:not(:disabled):active {
    transform: scale(0.9);
  }

  &:disabled {
    color: $color-disabled;
  }
}

.frame__history-button--redo {
  transform: scaleX(-1);

  &:not(:disabled):active {
    transform: scaleX(-1) scale(0.9);
  }
}
</style>
