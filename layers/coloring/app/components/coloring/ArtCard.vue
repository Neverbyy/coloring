<script setup lang="ts">
import type { GalleryArt } from '../../../shared/gallery'

defineProps<{ art: GalleryArt }>()
defineEmits<{ delete: [] }>()
</script>

<template>
  <div class="art-card">
    <NuxtLink class="art-card__link" :to="`/coloring/${art.id}`" :aria-label="`${art.title}, ${art.progress}%`">
      <span class="art-card__art">
        <img class="art-card__image" :src="art.image" :alt="art.title" draggable="false" loading="lazy">
      </span>
      <ColoringProgressFrame :progress="art.progress" />
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
  display: block;
  height: 100%;
  overflow: hidden;
  border-radius: $frame-radius - $frame-border;
}

.art-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
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
