<script setup lang="ts">
import { STROKE_OPACITIES, STROKE_WIDTHS } from '#layers/coloring/shared/history'

const store = useColoringToolsStore()
const { color, paintTool, widths, opacities, strokeOpacity } = storeToRefs(store)

const WIDTH_LABELS = ['Тонкая', 'Средняя', 'Толстая']
const OPACITY_LABELS = ['Яркая', 'Полупрозрачная', 'Прозрачная']
const DOT_SIZES = [10, 18, 28]
</script>

<template>
  <div class="stroke-options" role="group" aria-label="Толщина и прозрачность">
    <div class="stroke-options__row" role="radiogroup" aria-label="Толщина">
      <button
        v-for="(_, index) in STROKE_WIDTHS[paintTool]"
        :key="index"
        type="button"
        role="radio"
        class="stroke-options__button"
        :class="{ 'stroke-options__button--active': index === widths[paintTool] }"
        :aria-checked="index === widths[paintTool]"
        :aria-label="WIDTH_LABELS[index]"
        @click="store.selectWidth(index)"
      >
        <span class="stroke-options__dot" :style="{ '--size': `${DOT_SIZES[index]}px`, background: color, opacity: strokeOpacity }" />
      </button>
    </div>
    <div class="stroke-options__row" role="radiogroup" aria-label="Прозрачность">
      <button
        v-for="(opacity, index) in STROKE_OPACITIES"
        :key="index"
        type="button"
        role="radio"
        class="stroke-options__button"
        :class="{ 'stroke-options__button--active': index === opacities[paintTool] }"
        :aria-checked="index === opacities[paintTool]"
        :aria-label="OPACITY_LABELS[index]"
        @click="store.selectOpacity(index)"
      >
        <span class="stroke-options__dot" :style="{ '--size': '28px', background: color, opacity }" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stroke-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 4px solid $color-frame;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 12px 32px rgba($color-ink, 0.18);
}

.stroke-options__row {
  display: flex;
  gap: 8px;

  & + & {
    padding-top: 8px;
    border-top: 2px solid $color-board;
  }
}

.stroke-options__button {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 3px solid transparent;
  border-radius: 16px;
  background: $color-board;
  transition: transform 0.1s, border-color 0.15s, background-color 0.15s;
  @include pressable(0.9);
}

.stroke-options__button--active {
  border-color: $color-progress;
  background: #fff;
}

.stroke-options__dot {
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba($color-ink, 0.15);
}
</style>
