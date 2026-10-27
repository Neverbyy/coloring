<script setup lang="ts">
const emit = defineEmits<{ reset: [] }>()
</script>

<template>
  <div class="canvas-controls">
    <button type="button" class="canvas-controls__button" aria-label="Очистить рисунок" @click="emit('reset')">
      <img src="../../assets/icons/reset.svg" alt="" width="64" height="60">
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
</style>
