<script setup lang="ts">
import { STROKE_OPACITY_RANGE, STROKE_WIDTH_RANGES } from '#layers/coloring/shared/history'

const store = useColoringToolsStore()
const { color, paintTool, strokeWidth, strokeOpacity } = storeToRefs(store)

const PREVIEW_MIN = 8
const PREVIEW_MAX = 44
const TRANSPARENCY_STEP = 5
const TRANSPARENCY_TRACK = 'linear-gradient(to right, var(--color), color-mix(in srgb, var(--color) 10%, white))'

const widthRange = computed(() => STROKE_WIDTH_RANGES[paintTool.value])
const widthShare = computed(() => (strokeWidth.value - widthRange.value.min) / (widthRange.value.max - widthRange.value.min))
const previewSize = computed(() => Math.round(PREVIEW_MIN + widthShare.value * (PREVIEW_MAX - PREVIEW_MIN)))
const transparency = computed(() => Math.round((1 - strokeOpacity.value) * 100))
const maxTransparency = Math.round((1 - STROKE_OPACITY_RANGE.min) * 100)

function onTransparency(value: number) {
  store.setOpacity(1 - value / 100)
}
</script>

<template>
  <div class="stroke-options" role="group" aria-label="Толщина и прозрачность" :style="{ '--color': color }">
    <div class="stroke-options__preview" aria-hidden="true">
      <span class="stroke-options__dot" :style="{ '--size': `${previewSize}px`, opacity: strokeOpacity }" />
    </div>
    <ColoringOptionSlider
      label="Толщина"
      :value="strokeWidth"
      :min="widthRange.min"
      :max="widthRange.max"
      :step="1"
      @change="store.setWidth"
    />
    <ColoringOptionSlider
      label="Прозрачность"
      :value="transparency"
      :min="0"
      :max="maxTransparency"
      :step="TRANSPARENCY_STEP"
      :value-text="`${transparency}%`"
      :track="TRANSPARENCY_TRACK"
      @change="onTransparency"
    />
  </div>
</template>

<style scoped lang="scss">
.stroke-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stroke-options__preview {
  display: grid;
  place-items: center;
  height: 52px;
  border-radius: 16px;
  background: $color-board;
}

.stroke-options__dot {
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: var(--color);
  box-shadow: 0 0 0 1px rgba($color-ink, 0.15);
}
</style>
