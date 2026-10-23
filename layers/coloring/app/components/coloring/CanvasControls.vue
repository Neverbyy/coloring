<script setup lang="ts">
import type { ZoomMode } from '#layers/coloring/app/utils/zoom'

defineProps<{ zoomMode: ZoomMode | null }>()
const emit = defineEmits<{ reset: [], toggle: [mode: ZoomMode] }>()
</script>

<template>
  <div class="canvas-controls">
    <button type="button" class="canvas-controls__button" aria-label="Очистить рисунок" @click="emit('reset')">
      <img src="../../assets/icons/reset.svg" alt="" width="64" height="60">
    </button>
    <button
      type="button"
      class="canvas-controls__button canvas-controls__button--wide"
      :class="{ 'canvas-controls__button--active': zoomMode === 'in' }"
      aria-label="Приблизить"
      :aria-pressed="zoomMode === 'in'"
      @click="emit('toggle', 'in')"
    >
      <img src="../../assets/icons/zoom_in.svg" alt="" width="64" height="60">
    </button>
    <button
      type="button"
      class="canvas-controls__button canvas-controls__button--wide"
      :class="{ 'canvas-controls__button--active': zoomMode === 'out' }"
      aria-label="Отдалить"
      :aria-pressed="zoomMode === 'out'"
      @click="emit('toggle', 'out')"
    >
      <img src="../../assets/icons/zoom_out.svg" alt="" width="64" height="60">
    </button>
    <button
      type="button"
      class="canvas-controls__button canvas-controls__button--narrow"
      :class="{ 'canvas-controls__button--active': zoomMode === 'free' }"
      aria-label="Масштаб"
      :aria-pressed="zoomMode === 'free'"
      @click="emit('toggle', 'free')"
    >
      <img src="../../assets/icons/zoom_mobile.svg" alt="" width="64" height="60">
    </button>
  </div>
</template>

<style scoped lang="scss">
.canvas-controls {
  display: flex;
  gap: 6px;
  padding: 6px;
  border-radius: 18px;
  background: $color-frame;
}

.canvas-controls__button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 2px solid rgba($color-progress, 0.25);
  border-radius: 12px;
  background: rgba(#fff, 0.5);
  transition: transform 0.1s, background-color 0.15s, border-color 0.15s;
  @include pressable(0.9);

  img {
    display: block;
    width: 32px;
    height: auto;
  }
}

.canvas-controls__button--wide {
  @include below-desktop {
    display: none;
  }
}

.canvas-controls__button--narrow {
  display: none;

  @include below-desktop {
    display: grid;
  }
}

.canvas-controls__button--active {
  border-color: $color-progress;
  background: #fff;
}
</style>
