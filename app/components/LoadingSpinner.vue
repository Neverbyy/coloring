<script setup lang="ts">
withDefaults(defineProps<{ size?: number, delayed?: boolean }>(), { size: 56 })
</script>

<template>
  <span
    class="loading-spinner"
    :class="{ 'loading-spinner--delayed': delayed }"
    :style="{ '--size': `${size}px` }"
    aria-hidden="true"
  />
</template>

<style scoped lang="scss">
.loading-spinner {
  display: block;
  flex: none;
  width: var(--size);
  height: var(--size);
  border: calc(var(--size) / 7) solid $color-frame;
  border-top-color: $color-sky;
  border-radius: 50%;
  animation: loading-spinner-spin 0.8s linear infinite;
}

.loading-spinner--delayed {
  animation:
    loading-spinner-in 0.2s ease-out 0.15s both,
    loading-spinner-spin 0.8s linear infinite;
}

@keyframes loading-spinner-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes loading-spinner-in {
  from {
    opacity: 0;
  }
}
</style>
