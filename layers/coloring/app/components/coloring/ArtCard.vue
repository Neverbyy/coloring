<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import type { GalleryArt } from '../../../shared/gallery'

const props = defineProps<{ art: GalleryArt }>()
defineEmits<{ delete: [] }>()

// Рисунок начинает грузиться в момент нажатия — пока идёт переход, ответ уже в пути
const queryClient = useQueryClient()
function prefetch() {
  fetchDrawing(queryClient, props.art).catch(() => {})
}

// Свежий рисунок из этой вкладки показываем сразу, не дожидаясь ответа сервера
const previews = useDrawingPreviews()
const preview = computed(() => previews.get(props.art.id))
// Миниатюра рисунка — вся бумага с полями; раскладываем её как экран рисования:
// картинка вписана в карточку, поля заполняют остаток. Без рисунка — исходная картинка
const thumbnail = computed(() => preview.value?.thumbnail ?? props.art.thumbnail)
const paperStyle = computed(() => paperLayout(props.art.width, props.art.height))
const progress = computed(() => preview.value?.progress ?? props.art.progress)
</script>

<template>
  <div class="art-card">
    <NuxtLink
      class="art-card__link"
      :to="`/coloring/${art.id}`"
      :aria-label="`${art.title}, ${Math.floor(progress)}%`"
      @pointerdown="prefetch"
      @keydown.enter="prefetch"
    >
      <span class="art-card__art">
        <span class="art-card__stage" :style="{ '--ratio': art.width / art.height }">
          <img
            v-if="thumbnail"
            class="art-card__paper"
            :style="paperStyle"
            :src="thumbnail"
            :alt="art.title"
            draggable="false"
            loading="lazy"
          >
          <img v-else class="art-card__image" :src="art.image" :alt="art.title" draggable="false" loading="lazy">
        </span>
      </span>
      <ColoringProgressFrame :progress="progress" />
    </NuxtLink>
    <button
      v-if="art.own"
      type="button"
      class="art-card__delete"
      :aria-label="`Удалить «${art.title}»`"
      @click="$emit('delete')"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
.art-card {
  position: relative;
  height: 200px;
}

.art-card__link {
  position: relative;
  display: block;
  height: 100%;
  border: $frame-border solid $color-frame;
  border-radius: $frame-radius;
  background: #fff;
  transition: transform 0.15s;

  &:active {
    transform: scale(0.96);
  }
}

.art-card__art {
  container-type: size;
  display: grid;
  place-items: center;
  height: 100%;
  overflow: hidden;
  border-radius: $frame-radius - $frame-border;
}

// Размер вписанной картинки; бумага выходит за него, лишнее обрезает карточка
.art-card__stage {
  position: relative;
  display: block;
  width: min(100cqw, calc(100cqh * var(--ratio)));
  aspect-ratio: var(--ratio);
}

.art-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.art-card__paper {
  position: absolute;
  display: block;
  max-width: none;
}

.art-card__delete {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 4px solid #fff;
  border-radius: 50%;
  background: $color-accent;
  color: #fff;
  transition: transform 0.1s;

  &:active {
    transform: scale(0.9);
  }
}
</style>
