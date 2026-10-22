<template>
  <div class="orientation-guard" role="alert">
    <span class="orientation-guard__phone" aria-hidden="true" />
    <p class="orientation-guard__title">Поверни телефон</p>
    <p class="orientation-guard__text">Игра работает только в вертикальном положении</p>
  </div>
</template>

<style scoped lang="scss">
.orientation-guard {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px max(24px, env(safe-area-inset-right)) 24px max(24px, env(safe-area-inset-left));
  background: $color-sky;
  color: #fff;
  text-align: center;

  @include phone-landscape {
    display: flex;
  }
}

.orientation-guard__phone {
  width: 112px;
  height: 64px;
  margin-bottom: 12px;
  border: 8px solid #fff;
  border-radius: 16px;
  animation: orientation-guard-phone 2s ease-in-out infinite;
}

.orientation-guard__title {
  font-family: $font-display;
  font-size: 32px;
}

.orientation-guard__text {
  font-size: 18px;
  font-weight: 500;
  opacity: 0.9;
}

@keyframes orientation-guard-phone {
  0%,
  20% {
    transform: rotate(0);
  }

  50%,
  80% {
    transform: rotate(90deg);
  }

  100% {
    transform: rotate(0);
  }
}
</style>
