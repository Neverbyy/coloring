<script setup lang="ts">
const props = defineProps<{
  title: string
  image: string
  width: number
  height: number
  thumbnail?: string | null
}>()

const paperStyle = computed(() => paperLayout(props.width, props.height))
</script>

<template>
  <span class="thumbnail">
    <span class="thumbnail__stage" :style="{ '--ratio': width / height }">
      <img
        v-if="thumbnail"
        class="thumbnail__paper"
        :style="paperStyle"
        :src="thumbnail"
        :alt="title"
        draggable="false"
        loading="lazy"
      >
      <img v-else class="thumbnail__image" :src="image" :alt="title" draggable="false" loading="lazy">
    </span>
  </span>
</template>

<style scoped lang="scss">
.thumbnail {
  container-type: size;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.thumbnail__stage {
  position: relative;
  display: block;
  width: min(100cqw, calc(100cqh * var(--ratio)));
  aspect-ratio: var(--ratio);
}

.thumbnail__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumbnail__paper {
  position: absolute;
  display: block;
  max-width: none;
}
</style>
