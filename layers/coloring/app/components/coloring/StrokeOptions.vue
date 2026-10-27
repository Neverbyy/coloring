<script setup lang="ts">
import { STROKE_OPACITY_RANGE, STROKE_WIDTH_RANGES } from '#layers/coloring/shared/history'

const store = useColoringToolsStore()
const { color, paintTool, strokeWidth, strokeOpacity } = storeToRefs(store)

const PREVIEW_MIN = 8
const PREVIEW_MAX = 44
const TRANSPARENCY_STEP = 5

const widthRange = computed(() => STROKE_WIDTH_RANGES[paintTool.value])
const widthShare = computed(() => (strokeWidth.value - widthRange.value.min) / (widthRange.value.max - widthRange.value.min))
const previewSize = computed(() => Math.round(PREVIEW_MIN + widthShare.value * (PREVIEW_MAX - PREVIEW_MIN)))
const transparency = computed(() => Math.round((1 - strokeOpacity.value) * 100))
const maxTransparency = Math.round((1 - STROKE_OPACITY_RANGE.min) * 100)

function onWidth(event: Event) {
  store.setWidth(Number((event.target as HTMLInputElement).value))
}

function onTransparency(event: Event) {
  store.setOpacity(1 - Number((event.target as HTMLInputElement).value) / 100)
}
</script>

<template>
  <div class="stroke-options" role="group" aria-label="Толщина и прозрачность" data-silent :style="{ '--color': color }">
    <div class="stroke-options__preview" aria-hidden="true">
      <span class="stroke-options__dot" :style="{ '--size': `${previewSize}px`, opacity: strokeOpacity }" />
    </div>
    <label class="stroke-options__row">
      <span class="stroke-options__label">Толщина</span>
      <input
        class="stroke-options__slider stroke-options__slider--width"
        type="range"
        :min="widthRange.min"
        :max="widthRange.max"
        step="1"
        :value="strokeWidth"
        :style="{ '--fill': `${widthShare * 100}%` }"
        @input="onWidth"
      >
    </label>
    <label class="stroke-options__row">
      <span class="stroke-options__label">
        Прозрачность
        <span class="stroke-options__value">{{ transparency }}%</span>
      </span>
      <input
        class="stroke-options__slider stroke-options__slider--transparency"
        type="range"
        min="0"
        :max="maxTransparency"
        :step="TRANSPARENCY_STEP"
        :value="transparency"
        :aria-valuetext="`${transparency}%`"
        @input="onTransparency"
      >
    </label>
  </div>
</template>

<style scoped lang="scss">
$thumb-size: 28px;
$track-height: 12px;

@mixin track {
  height: $track-height;
  border-radius: $track-height;
  background: var(--track);
}

@mixin thumb {
  width: $thumb-size;
  height: $thumb-size;
  border: 4px solid $color-progress;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba($color-ink, 0.25);
}

.stroke-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 232px;
  padding: 12px 14px 10px;
  border: 4px solid $color-frame;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 12px 32px rgba($color-ink, 0.18);
  color: $color-ink;
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

.stroke-options__row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stroke-options__label {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 700;
}

.stroke-options__value {
  color: rgba($color-ink, 0.6);
  font-weight: 500;
}

.stroke-options__slider {
  appearance: none;
  width: 100%;
  height: 36px;
  margin: 0;
  background: transparent;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    @include track;
  }

  &::-moz-range-track {
    @include track;
  }

  &::-webkit-slider-thumb {
    @include thumb;
    appearance: none;
    margin-top: calc((#{$track-height} - #{$thumb-size}) / 2);
  }

  &::-moz-range-thumb {
    @include thumb;
    box-sizing: border-box;
  }

  &:focus-visible {
    outline: none;

    &::-webkit-slider-thumb {
      outline: 3px solid $color-ink;
      outline-offset: 2px;
    }

    &::-moz-range-thumb {
      outline: 3px solid $color-ink;
      outline-offset: 2px;
    }
  }
}

.stroke-options__slider--width {
  --track: linear-gradient(to right, #{$color-progress} var(--fill), #{$color-board} var(--fill));
}

.stroke-options__slider--transparency {
  --track: linear-gradient(to right, var(--color), color-mix(in srgb, var(--color) 10%, white));
}
</style>
