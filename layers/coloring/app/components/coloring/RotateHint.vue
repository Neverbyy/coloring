<script setup lang="ts">
// Подсказка поверх повёрнутого экрана рисования в портретной ориентации телефона.
// Не блокирует игру: исчезает по нажатию или сама; снова появляется при возврате в портрет
const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 599px)'
const AUTO_HIDE_MS = 4000

const visible = ref(true)
let timer: ReturnType<typeof setTimeout> | undefined
let media: MediaQueryList | undefined

function show() {
  visible.value = true
  clearTimeout(timer)
  timer = setTimeout(() => { visible.value = false }, AUTO_HIDE_MS)
}

function hide() {
  visible.value = false
  clearTimeout(timer)
}

function onOrientationChange(event: MediaQueryListEvent) {
  if (event.matches) show()
}

onMounted(() => {
  media = window.matchMedia(PORTRAIT_QUERY)
  media.addEventListener('change', onOrientationChange)
  if (media.matches) show()
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  media?.removeEventListener('change', onOrientationChange)
})
</script>

<template>
  <!-- В body: внутри повёрнутого экрана fixed отсчитывался бы от него и подсказка повернулась бы тоже -->
  <Teleport to="body">
    <Transition name="rotate-hint">
      <div v-if="visible" class="rotate-hint" role="status" @click="hide">
        <span class="rotate-hint__phone" aria-hidden="true" />
        <p class="rotate-hint__text">Поверни телефон</p>
        <p class="rotate-hint__note">или нажми, чтобы продолжить</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.rotate-hint {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba($color-sky, 0.92);
  color: #fff;
  cursor: pointer;

  // Тот же запрос, что и у поворота экрана рисования
  @media (orientation: portrait) and (max-width: 599px) {
    display: flex;
  }
}

.rotate-hint__phone {
  width: 64px;
  height: 112px;
  margin-bottom: 16px;
  border: 8px solid #fff;
  border-radius: 16px;
  // Поворот против часовой — в ту сторону, под которую повёрнут экран
  animation: rotate-hint-phone 2s ease-in-out infinite;
}

.rotate-hint__text {
  font-family: $font-display;
  font-size: 28px;
}

.rotate-hint__note {
  font-size: 16px;
  font-weight: 500;
  opacity: 0.85;
}

.rotate-hint-leave-active {
  transition: opacity 0.25s;
}

.rotate-hint-leave-to {
  opacity: 0;
}

@keyframes rotate-hint-phone {
  0%,
  20% {
    transform: rotate(0);
  }

  50%,
  80% {
    transform: rotate(-90deg);
  }

  100% {
    transform: rotate(0);
  }
}
</style>
