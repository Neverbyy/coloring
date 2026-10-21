<script setup lang="ts">
// Короткое сообщение внизу экрана: гаснет само, закрывается тапом
const props = defineProps<{ message: string | null, tone?: 'error' | 'info' }>()
const emit = defineEmits<{ close: [] }>()

const NOTICE_MS = 4500

let timer: ReturnType<typeof setTimeout> | undefined
watch(() => props.message, (message) => {
  clearTimeout(timer)
  if (message) timer = setTimeout(() => emit('close'), NOTICE_MS)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <!-- Область aria-live есть всегда: читалка объявляет то, что в ней появляется -->
  <div class="notice-region" aria-live="polite">
    <Transition name="notice">
      <button
        v-if="message"
        :key="message"
        type="button"
        class="notice"
        :class="`notice--${tone ?? 'info'}`"
        @click="emit('close')"
      >
        {{ message }}
      </button>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.notice-region {
  position: fixed;
  right: 16px;
  bottom: max(24px, env(safe-area-inset-bottom));
  left: 16px;
  z-index: 10;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.notice {
  max-width: 480px;
  padding: 14px 24px;
  border: 4px solid $color-frame;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 6px 0 rgba($color-ink, 0.15);
  color: $color-ink;
  font-family: $font-body;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  pointer-events: auto;
}

.notice--error {
  border-color: $color-accent;
}

.notice-enter-active {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s;
}

.notice-leave-active {
  transition: transform 0.15s, opacity 0.15s;
}

.notice-enter-from,
.notice-leave-to {
  transform: translateY(24px);
  opacity: 0;
}
</style>
