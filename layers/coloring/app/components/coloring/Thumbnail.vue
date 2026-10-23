<script setup lang="ts">
const props = defineProps<{
  title: string
  image: string
  width: number
  height: number
  thumbnail?: string | null
}>()

const paperStyle = computed(() => paperLayout(props.width, props.height))
const source = computed(() => props.thumbnail || props.image)
const picture = useTemplateRef<HTMLImageElement>('picture')
const loading = ref(true)

function settle() {
  loading.value = false
}

function settleIfComplete() {
  if (picture.value?.complete) settle()
}

watch(source, () => {
  loading.value = true
  nextTick(settleIfComplete)
})

onMounted(settleIfComplete)
</script>

<template>
  <span class="thumbnail">
    <LoadingSpinner v-if="loading" class="thumbnail__spinner" :size="48" delayed />
    <span class="thumbnail__stage" :style="{ '--ratio': width / height }">
      <img
        v-if="thumbnail"
        ref="picture"
        class="thumbnail__paper"
        :style="paperStyle"
        :src="thumbnail"
        :alt="title"
        draggable="false"
        loading="lazy"
        @load="settle"
        @error="settle"
      >
      <img
        v-else
        ref="picture"
        class="thumbnail__image"
        :src="image"
        :alt="title"
        draggable="false"
        loading="lazy"
        @load="settle"
        @error="settle"
      >
    </span>
  </span>
</template>

<style scoped lang="scss">
.thumbnail {
  position: relative;
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
  background: #fff;
}

.thumbnail__paper {
  position: absolute;
  display: block;
  max-width: none;
}

.thumbnail__spinner {
  position: absolute;
  inset: 0;
  margin: auto;
  pointer-events: none;
}
</style>
