<template>
  <!-- Экран рисования рассчитан на горизонтальную ориентацию (как макет) -->
  <div class="rotate-hint" role="status">
    <span class="rotate-hint__phone" aria-hidden="true" />
    <p class="rotate-hint__text">Поверни телефон</p>
  </div>
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
  gap: 32px;
  background: $color-sky;
  color: #fff;

  @media (orientation: portrait) and (max-width: 599px) {
    display: flex;
  }
}

.rotate-hint__phone {
  width: 64px;
  height: 112px;
  border: 8px solid #fff;
  border-radius: 16px;
  animation: rotate-hint 2s ease-in-out infinite;
}

.rotate-hint__text {
  font-family: $font-display;
  font-size: 28px;
}

@keyframes rotate-hint {
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
