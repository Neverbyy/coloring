<script setup lang="ts">
defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ select: [file: File] }>()

const dragging = ref(false)

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('select', file)
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) emit('select', file)
}
</script>

<template>
  <label
    class="import-card"
    :class="{ 'import-card--dragging': dragging, 'import-card--loading': loading }"
    :aria-busy="loading"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="loading || onDrop($event)"
  >
    <input
      class="visually-hidden"
      type="file"
      accept=".svg,image/svg+xml"
      :disabled="loading"
      @change="onChange"
    >
    <LoadingSpinner v-if="loading" />
    <img v-else class="import-card__icon" src="../../assets/icons/plus.svg" alt="" width="64" height="64">
    <span class="visually-hidden">{{ loading ? 'Готовим картинку…' : 'Добавить свою картинку (SVG)' }}</span>
  </label>
</template>

<style scoped lang="scss">
.import-card {
  display: grid;
  place-items: center;
  height: $card-height;
  @include frame-card;
  cursor: pointer;
  transition: transform 0.25s $lift-easing, border-color 0.15s;

  @include on-hover {
    transform: translateY(-6px);

    .import-card__icon {
      transform: rotate(90deg) scale(1.1);
    }
  }

  @include pressable;

  &:has(input:focus-visible) {
    @include frame-focus;
  }
}

.import-card--dragging {
  border-color: $color-progress;
  transform: scale(1.03);
}

.import-card--loading {
  cursor: progress;

  &:active {
    transform: none;
  }
}

.import-card__icon {
  display: block;
  transition: transform 0.3s $lift-easing;
}
</style>
