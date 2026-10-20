<script setup lang="ts">
const route = useRoute()
const tools = useColoringToolsStore()

const id = computed(() => String(route.params.id))
const { data: art, error, suspense } = useArtQuery(id)
// Ошибку разбираем ниже, suspense лишь дожидается ответа
await suspense().catch(() => undefined)

if (error.value) {
  const statusCode = (error.value as { statusCode?: number }).statusCode ?? 500
  throw createError({
    statusCode,
    statusMessage: statusCode === 404 ? 'Раскраска не найдена' : 'Не удалось загрузить раскраску',
    fatal: true
  })
}

useHead({ title: () => `${art.value?.title ?? 'Раскраска'} — Раскраска` })

const progress = computed(() => Math.round(art.value?.progress ?? 0))

useGameFullscreen({ lockLandscape: true })

// История действий появится вместе с движком рисования
const canUndo = ref(false)
const canRedo = ref(false)
</script>

<template>
  <main v-if="art" class="art-screen">
    <div class="board">
      <div class="board__left">
        <NuxtLink class="board__home" to="/coloring" aria-label="В галерею">
          <img src="../../assets/icons/home.svg" alt="" width="64" height="60">
        </NuxtLink>
        <button type="button" class="board__camera" aria-label="Сохранить или поделиться картинкой">
          <img src="../../assets/icons/camera.svg" alt="" width="64" height="65">
        </button>
      </div>

      <section class="frame" aria-label="Рисунок">
        <div class="frame__art" @pointerdown="tools.closePalette()">
          <img class="frame__image" :src="art.image" :alt="art.title" draggable="false">
        </div>

        <p class="frame__progress" aria-live="polite">{{ progress }}%</p>

        <div class="frame__history">
          <button type="button" class="frame__history-button" :disabled="!canUndo" aria-label="Отменить">
            <ColoringUndoIcon />
          </button>
          <button
            type="button"
            class="frame__history-button frame__history-button--redo"
            :disabled="!canRedo"
            aria-label="Повторить"
          >
            <ColoringUndoIcon />
          </button>
        </div>

        <ColoringProgressFrame :progress="progress" />
      </section>

      <div class="board__right">
        <ColoringSidePanel />
      </div>
    </div>

    <ColoringRotateHint />
  </main>
</template>

<style scoped lang="scss">
$column-width: 90px;

// Мобильный: доска на весь экран. Десктоп: доска не больше 1280×920 по центру, со скруглением
.art-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $color-board;

  @include desktop {
    padding: 20px;
    background: $color-sky;
  }

  // Телефон в портретной ориентации: экран рассчитан на горизонталь, поэтому поворачиваем его
  // на 90° по часовой. Игрок поворачивает телефон — и игра встаёт ровно, даже если автоповорот
  // выключен (тогда браузер остаётся «портретным»). При включённом автоповороте браузер сам
  // перейдёт в горизонталь, и это правило перестанет действовать
  @media (orientation: portrait) and (max-width: 599px) {
    inset: auto;
    top: 0;
    left: 0;
    width: 100vh;
    width: 100dvh;
    height: 100vw;
    height: 100dvw;
    transform-origin: top left;
    transform: translateX(100vw) rotate(90deg);
    transform: translateX(100dvw) rotate(90deg);
  }
}

.board {
  display: flex;
  width: 100%;
  height: 100%;
  max-width: 1280px;
  max-height: 920px;
  padding-top: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  background: $color-board;

  @include desktop {
    overflow: hidden;
    border-radius: $frame-radius;
  }
}

.board__left {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: $column-width;
  // Снизу отступа нет: в макете камера стоит вплотную к нижнему краю колонки
  padding-top: 16px;
}

.board__home,
.board__camera {
  display: block;
  transition: transform 0.1s;

  &:active {
    transform: scale(0.9);
  }

  img {
    display: block;
  }
}

// Камера в макете повёрнута на −15° внутри рамки 78.7×79.7
.board__camera {
  display: grid;
  place-items: center;
  width: 79px;
  height: 80px;

  img {
    transform: rotate(-15deg);
  }
}

// Карандаши справа уходят за край экрана — колонка заходит в safe area
.board__right {
  flex: none;
  width: calc(#{$column-width} + env(safe-area-inset-right));
}

.frame {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  border: $frame-border solid $color-frame;
  border-radius: $frame-radius;
  background: #fff;
}

.frame__art {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: $frame-radius - $frame-border;
  touch-action: none;
}

.frame__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

// В макете левый край «0%» в 80px от правого края; прижимаем по правому, чтобы «100%» рос влево
.frame__progress {
  position: absolute;
  top: 26px;
  right: 29px;
  font-family: $font-display;
  font-size: 32px;
  line-height: 32px;
  letter-spacing: 0.2px;
  color: #000;
  pointer-events: none;
}

.frame__history {
  position: absolute;
  bottom: 0;
  left: 50%;
  display: flex;
  gap: 24px;
  padding: 0 24px;
  border-radius: 24px 24px 0 0;
  background: $color-frame;
  transform: translateX(-50%);
}

.frame__history-button {
  width: 55.94px;
  height: 55.94px;
  color: #000;
  transition: transform 0.1s, color 0.2s;

  &:not(:disabled):active {
    transform: scale(0.9);
  }

  &:disabled {
    color: $color-disabled;
  }

  @include desktop {
    width: 74.58px;
    height: 74.58px;
  }

  // Низкий экран (телефон с панелью браузера): стрелки меньше, чтобы не закрывать рисунок
  @media (max-height: 360px) {
    width: 44px;
    height: 44px;
  }
}

.frame__history-button--redo {
  transform: scaleX(-1);

  &:not(:disabled):active {
    transform: scaleX(-1) scale(0.9);
  }
}
</style>
