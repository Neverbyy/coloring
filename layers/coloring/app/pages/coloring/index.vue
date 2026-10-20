<script setup lang="ts">
useHead({ title: 'Галерея — Раскраска' })

const route = useRoute()
const router = useRouter()
const scroller = ref<HTMLElement | null>(null)

const page = computed(() => {
  const value = Number.parseInt(String(route.query.page ?? '1'), 10)
  return Number.isFinite(value) && value > 0 ? value : 1
})

const { data, isPlaceholderData, suspense } = useGalleryPageQuery(page)
// SSR отдаёт галерею уже с данными; в браузере запрос не повторяется (dehydrate/hydrate).
// Если страница уже в кэше (возврат из арта) — показываем сразу, обновление идёт в фоне
if (import.meta.server || !data.value) await suspense()

// Сервер вернул другую страницу (номер вне диапазона) — исправляем адрес
watch(() => data.value?.page, (actual) => {
  if (actual && actual !== page.value && !isPlaceholderData.value) {
    router.replace({ query: { ...route.query, page: actual === 1 ? undefined : String(actual) } })
  }
}, { immediate: true })

watch(page, () => scroller.value?.scrollTo({ top: 0 }))

function onImport(_file: File) {
  // Импорт SVG (санитизация и разметка сегментов на сервере) — следующий этап
}
</script>

<template>
  <main ref="scroller" class="gallery">
    <div class="gallery__inner">
      <div class="gallery__content" :class="{ 'gallery__content--loading': isPlaceholderData }">
        <ul class="gallery__grid">
          <li>
            <ColoringImportCard @select="onImport" />
          </li>
          <li v-for="art in data?.items ?? []" :key="art.id">
            <ColoringArtCard :art="art" />
          </li>
        </ul>

        <ColoringPagination v-if="data && data.pageCount > 1" :page="data.page" :page-count="data.pageCount" />
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
$gap: 24px;

.gallery {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  background: $color-sky;

  &::-webkit-scrollbar {
    display: none;
  }
}

.gallery__inner {
  display: flex;
  min-height: 100%;
  padding:
    max($gap, env(safe-area-inset-top))
    max($gap, env(safe-area-inset-right))
    max($gap, env(safe-area-inset-bottom))
    max($gap, env(safe-area-inset-left));
}

// margin: auto центрирует галерею, пока она помещается (десктоп),
// и прижимает к верху, когда карточек больше экрана (мобильный)
.gallery__content {
  display: flex;
  flex-direction: column;
  gap: $gap;
  width: 100%;
  max-width: 1100px;
  margin: auto;
  transition: opacity 0.15s;
}

.gallery__content--loading {
  opacity: 0.6;
}

.gallery__grid {
  display: grid;
  // Не больше 4 колонок (как в макете), но не уже 140px — на узких экранах колонок меньше
  grid-template-columns: repeat(auto-fill, minmax(max(140px, calc((100% - 3 * #{$gap}) / 4)), 1fr));
  gap: $gap;
}
</style>
