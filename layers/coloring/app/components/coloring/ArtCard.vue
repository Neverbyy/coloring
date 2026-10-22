<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import type { GalleryArt } from '#layers/coloring/shared/gallery'

const props = defineProps<{ art: GalleryArt, deleting?: boolean }>()
const emit = defineEmits<{ delete: [] }>()

const confirming = ref(false)

const PREFETCH_HOLD_MS = 100
const queryClient = useQueryClient()
let prefetchTimer: ReturnType<typeof setTimeout> | undefined

function prefetch() {
  cancelPrefetch()
  fetchDrawing(queryClient, props.art).catch(() => {})
}

function startPrefetch() {
  cancelPrefetch()
  prefetchTimer = setTimeout(prefetch, PREFETCH_HOLD_MS)
}

function cancelPrefetch() {
  clearTimeout(prefetchTimer)
  prefetchTimer = undefined
}

function flushPrefetch() {
  if (prefetchTimer) prefetch()
}

onBeforeUnmount(cancelPrefetch)

const previews = useDrawingPreviews()
const preview = computed(() => previews.get(props.art.id))
const thumbnail = computed(() => preview.value?.thumbnail ?? props.art.thumbnail)
const progress = computed(() => preview.value?.progress ?? props.art.progress)
</script>

<template>
  <div class="art-card">
    <NuxtLink
      class="art-card__link"
      :to="`/coloring/${art.id}`"
      :aria-label="`${art.title}${art.isNew ? ', новое' : ''}, ${Math.floor(progress)}%`"
      @pointerdown="startPrefetch"
      @pointerup="flushPrefetch"
      @pointercancel="cancelPrefetch"
      @keydown.enter="prefetch"
    >
      <ColoringThumbnail
        class="art-card__art"
        :title="art.title"
        :image="art.image"
        :width="art.width"
        :height="art.height"
        :thumbnail="thumbnail"
      />
      <ColoringProgressFrame :progress="progress" />
    </NuxtLink>
    <span v-if="art.isNew" class="art-card__new" aria-hidden="true">Новое</span>
    <button
      v-if="art.own && !confirming"
      type="button"
      class="art-card__delete"
      :aria-label="`Удалить «${art.title}»`"
      @click="confirming = true"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
    </button>
    <Transition name="art-card-confirm">
      <div v-if="confirming" class="art-card__confirm" role="group" :aria-label="`Удалить «${art.title}»?`">
        <span class="art-card__question">Удалить?</span>
        <span class="art-card__answers">
          <button
            type="button"
            class="art-card__answer art-card__answer--yes"
            aria-label="Да, удалить"
            :disabled="deleting"
            @click="emit('delete')"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            class="art-card__answer"
            aria-label="Нет, оставить"
            :disabled="deleting"
            @click="confirming = false"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
            </svg>
          </button>
        </span>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.art-card {
  position: relative;
  height: $card-height;
  transition: transform 0.25s $lift-easing;

  @include on-hover {
    transform: translateY(-6px);
  }
}

.art-card__link {
  position: relative;
  display: block;
  height: 100%;
  @include frame-card;
  transition: transform 0.15s;
  @include pressable;

  &:focus-visible {
    @include frame-focus;
  }
}

.art-card__art {
  height: 100%;
  border-radius: $frame-radius - $frame-border;
}

.art-card__delete {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 4px solid #fff;
  border-radius: 50%;
  background: $color-accent;
  color: #fff;
  transition: transform 0.1s;
  @include pressable(0.9);
}

.art-card__new {
  position: absolute;
  top: 0;
  left: 14px;
  height: 36px;
  padding: 0 14px;
  border: 4px solid #fff;
  border-radius: 18px;
  background: $color-accent;
  color: #fff;
  font: 18px/28px $font-display;
  white-space: nowrap;
  transform: rotate(-6deg);
  pointer-events: none;
}

.art-card__confirm {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  @include frame-card;
  background: rgba(#fff, 0.92);
}

.art-card__question {
  color: $color-ink;
  font-family: $font-display;
  font-size: 28px;
}

.art-card__answers {
  display: flex;
  gap: 16px;
}

.art-card__answer {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: $color-frame;
  color: $color-ink;
  transition: transform 0.1s, opacity 0.15s;
  @include pressable(0.9);

  &:disabled {
    opacity: 0.5;
  }
}

.art-card__answer--yes {
  @include accent-button(4px);
}

.art-card-confirm-enter-active,
.art-card-confirm-leave-active {
  transition: opacity 0.15s;
}

.art-card-confirm-enter-from,
.art-card-confirm-leave-to {
  opacity: 0;
}
</style>
