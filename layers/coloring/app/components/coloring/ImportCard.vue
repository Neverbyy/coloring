<script setup lang="ts">
const emit = defineEmits<{ select: [file: File] }>()

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Сбрасываем, чтобы повторный выбор того же файла снова вызвал change
  input.value = ''
  if (file) emit('select', file)
}
</script>

<template>
  <label class="import-card">
    <input class="visually-hidden" type="file" accept=".svg,image/svg+xml" @change="onChange">
    <img class="import-card__icon" src="../../assets/icons/plus.svg" alt="" width="64" height="64">
    <span class="visually-hidden">Добавить свою картинку (SVG)</span>
  </label>
</template>

<style scoped lang="scss">
.import-card {
  display: grid;
  place-items: center;
  height: 200px;
  border: $frame-border solid $color-frame;
  border-radius: $frame-radius;
  background: #fff;
  cursor: pointer;
  transition: transform 0.15s;

  &:active {
    transform: scale(0.96);
  }

  &:focus-within {
    outline: 3px solid $color-ink;
    outline-offset: 2px;
  }
}

.import-card__icon {
  display: block;
}
</style>
