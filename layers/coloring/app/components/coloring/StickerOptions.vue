<script setup lang="ts">
import { STICKERS, STICKER_SIZE_RANGE } from '#layers/coloring/shared/history'

const store = useColoringToolsStore()
const { sticker, stickerSize } = storeToRefs(store)

const SIZE_STEP = 8
</script>

<template>
  <div class="sticker-options" role="group" aria-label="Стикеры">
    <ul class="sticker-options__list">
      <li v-for="id in STICKERS" :key="id">
        <button
          type="button"
          class="sticker-options__item"
          :class="{ 'sticker-options__item--active': id === sticker }"
          :aria-label="STICKER_LABELS[id]"
          :aria-pressed="id === sticker"
          @click="store.selectSticker(id)"
        >
          <img :src="STICKER_IMAGES[id]" alt="" draggable="false">
        </button>
      </li>
    </ul>
    <ColoringOptionSlider
      label="Размер"
      :value="stickerSize"
      :min="STICKER_SIZE_RANGE.min"
      :max="STICKER_SIZE_RANGE.max"
      :step="SIZE_STEP"
      @change="store.setStickerSize"
    />
  </div>
</template>

<style scoped lang="scss">
.sticker-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sticker-options__list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.sticker-options__item {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  padding: 8px;
  border: 3px solid transparent;
  border-radius: 16px;
  background: $color-board;
  transition: transform 0.1s, border-color 0.15s, background-color 0.15s;
  @include pressable(0.92);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
}

.sticker-options__item--active {
  border-color: $color-progress;
  background: #fff;
}
</style>
