<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  label: string
  value: number
  min: number
  max: number
  step: number
  valueText?: string
  track?: string
}>()
const emit = defineEmits<{ change: [value: number] }>()

const fill = computed(() => `${(props.value - props.min) / (props.max - props.min) * 100}%`)

function onInput(event: Event) {
  emit('change', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <label class="option-slider" data-silent>
    <span class="option-slider__label">
      {{ label }}
      <span v-if="valueText" class="option-slider__value">{{ valueText }}</span>
    </span>
    <input
      class="option-slider__input"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="value"
      :aria-valuetext="valueText"
      :style="{ '--fill': fill, '--track': track }"
      v-bind="$attrs"
      @input="onInput"
    >
  </label>
</template>

<style scoped lang="scss">
$thumb-size: 28px;
$track-height: 12px;

@mixin track {
  height: $track-height;
  border-radius: $track-height;
  background: var(--track, linear-gradient(to right, #{$color-progress} var(--fill), #{$color-board} var(--fill)));
}

@mixin thumb {
  width: $thumb-size;
  height: $thumb-size;
  border: 4px solid $color-progress;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba($color-ink, 0.25);
}

.option-slider {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-slider__label {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 700;
}

.option-slider__value {
  color: rgba($color-ink, 0.6);
  font-weight: 500;
}

.option-slider__input {
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
</style>
