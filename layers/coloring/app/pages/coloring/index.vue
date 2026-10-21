<script setup lang="ts">
import type { GalleryArt } from '../../../shared/gallery'

useHead({ title: 'Галерея — Раскраска' })

const route = useRoute()
const router = useRouter()
const scroller = ref<HTMLElement | null>(null)
const pager = ref<HTMLElement | null>(null)

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

// Смена страницы анимируется в сторону листания: вперёд — карточки въезжают справа, назад — слева.
// Ключ сетки — номер показанной страницы: пока новая грузится, остаётся прежняя (без анимации)
// Длительности — с CSS ниже: уход сетки и въезд карточек по очереди (последняя — с задержкой)
const PAGE_LEAVE_MS = 140
const PAGE_ENTER_MS = 450
const pageTransition = ref('gallery-page-next')
watch(() => data.value?.page, (next, previous) => {
  if (next && previous) pageTransition.value = next >= previous ? 'gallery-page-next' : 'gallery-page-prev'
})

// На узком экране — лента экранов со свайпом вместо пагинации
const { swipe, screens, currentScreen, goToScreen, showFirst, onScroll } = useGalleryScreens(pager, data)
const { importing, importArt, deleteArt } = useOwnArts()
const notice = ref<{ message: string, tone: 'error' | 'info' } | null>(null)
const deletingId = ref<string | null>(null)

function showError(error: unknown, fallback: string) {
  notice.value = { message: error instanceof OwnArtError ? error.message : fallback, tone: 'error' }
}

async function onImport(file: File) {
  if (importing.value) return
  notice.value = null
  try {
    const { notes } = await importArt(file)
    // Новый арт — первый в галерее
    if (swipe.value) {
      showFirst()
    } else {
      if (page.value !== 1) await router.push({ query: { ...route.query, page: undefined } })
      scroller.value?.scrollTo({ top: 0, behavior: 'smooth' })
    }
    if (notes.length) notice.value = { message: notes.join(' '), tone: 'info' }
  } catch (error) {
    showError(error, 'Не получилось загрузить рисунок')
  }
}

async function onDelete(art: GalleryArt) {
  deletingId.value = art.id
  try {
    await deleteArt(art)
  } catch (error) {
    showError(error, 'Не получилось удалить рисунок')
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <!-- Файл, брошенный мимо карточки «+», браузер открыл бы вместо игры -->
  <main ref="scroller" class="gallery" @dragover.prevent @drop.prevent>
    <div ref="pager" class="gallery__pager" @scroll.passive="onScroll">
      <div
        v-for="(screen, index) in screens"
        :key="index"
        class="gallery__screen"
        :aria-label="screens.length > 1 ? `Экран ${index + 1} из ${screens.length}` : undefined"
      >
        <div
          class="gallery__content"
          :class="{
            'gallery__content--loading': isPlaceholderData && !swipe,
            'gallery__content--paged': !swipe && data && data.pageCount > 1
          }"
        >
          <Transition :name="pageTransition" mode="out-in" :duration="{ enter: PAGE_ENTER_MS, leave: PAGE_LEAVE_MS }">
            <ul :key="swipe ? `screen-${index}` : `page-${data?.page}`" class="gallery__grid">
              <li v-for="(entry, position) in screen" :key="entry.key" :style="{ '--i': position }">
                <ColoringImportCard v-if="entry.kind === 'import'" :loading="importing" @select="onImport" />
                <ColoringArtCard
                  v-else-if="entry.kind === 'art'"
                  :art="entry.art"
                  :deleting="deletingId === entry.art.id"
                  @delete="onDelete(entry.art)"
                />
                <span v-else class="gallery__placeholder" aria-hidden="true" />
              </li>
            </ul>
          </Transition>

          <!-- Обёртка — своя: на узких экранах её прячет CSS ещё до загрузки скриптов -->
          <div v-if="!swipe && data && data.pageCount > 1" class="gallery__pagination">
            <ColoringPagination :page="data.page" :page-count="data.pageCount" />
          </div>
        </div>
      </div>
    </div>

    <nav v-if="swipe && screens.length > 1" class="gallery__dots" aria-label="Экраны галереи">
      <button
        v-for="(_, index) in screens"
        :key="index"
        type="button"
        class="gallery__dot"
        :class="{ 'gallery__dot--current': index === currentScreen }"
        :aria-label="`Экран ${index + 1}`"
        :aria-current="index === currentScreen ? 'true' : undefined"
        @click="goToScreen(index, true)"
      />
    </nav>

    <div class="gallery__toolbar">
      <MusicToggle />
    </div>

    <ColoringNotice :message="notice?.message ?? null" :tone="notice?.tone" @close="notice = null" />
  </main>
</template>

<style scoped lang="scss">
$gap: 24px;
// Место под точки экранов внизу
$dots-height: 40px;
// Кнопка музыки слева сверху (не выше выреза экрана); карточки начинаются под ней
$toolbar-y: max(24px, env(safe-area-inset-top));
$toolbar-size: 56px;
$toolbar-gap: 20px;

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

.gallery__pager {
  display: flex;
  min-height: 100%;
}

// Сверху — место под кнопку музыки (во всех раскладках: иначе она закрыла бы первую карточку)
.gallery__screen {
  display: flex;
  flex: 1 0 100%;
  padding:
    calc(#{$toolbar-y} + #{$toolbar-size + $toolbar-gap})
    max($gap, env(safe-area-inset-right))
    max($gap, env(safe-area-inset-bottom))
    max($gap, env(safe-area-inset-left));
}

.gallery__toolbar {
  position: fixed;
  top: $toolbar-y;
  left: max($gap, env(safe-area-inset-left));
  z-index: 5;
}

// margin: auto центрирует галерею, пока она помещается (десктоп),
// и прижимает к верху, когда карточек больше экрана
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

// Несколько страниц: карточки — от верха, пагинация — у нижнего края экрана (или сразу под
// карточками, если их больше экрана). Иначе на неполной странице сетка центрировалась
// и пагинация прыгала при переключении
@media (min-width: 681px) {
  .gallery__content--paged {
    align-self: stretch;
    margin: 0 auto;
  }

  .gallery__content--paged .gallery__pagination {
    margin-top: auto;
  }
}

.gallery__grid {
  display: grid;
  // Не больше 4 колонок (как в макете), но не уже 140px — на узких экранах колонок меньше
  grid-template-columns: repeat(auto-fill, minmax(max(140px, calc((100% - 3 * #{$gap}) / 4)), 1fr));
  gap: $gap;
}

// Смена страницы (PAGE_LEAVE_MS / PAGE_ENTER_MS в скрипте): прежняя сетка быстро уходит
// в сторону листания, карточки новой въезжают с другой стороны по очереди — 12 карточек
// укладываются в 450 мс (задержка 15 мс на карточку + 280 мс въезда)
.gallery-page-next-leave-active,
.gallery-page-prev-leave-active {
  transition: opacity 0.14s ease-in, transform 0.14s ease-in;
}

.gallery-page-next-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.gallery-page-prev-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.gallery-page-next-enter-active > li,
.gallery-page-prev-enter-active > li {
  animation: gallery-card-in 0.28s $lift-easing both;
  animation-delay: calc(var(--i) * 15ms);
}

.gallery-page-prev-enter-active > li {
  animation-name: gallery-card-in-back;
}

@keyframes gallery-card-in {
  from {
    opacity: 0;
    transform: translateX(32px) scale(0.94);
  }
}

@keyframes gallery-card-in-back {
  from {
    opacity: 0;
    transform: translateX(-32px) scale(0.94);
  }
}

// Заглушка карточки: пока страница грузится, экран уже нужного размера
.gallery__placeholder {
  display: block;
  height: $card-height;
  border: $frame-border solid rgba($color-frame, 0.6);
  border-radius: $frame-radius;
  background: rgba(#fff, 0.5);
}

.gallery__dots {
  position: absolute;
  right: 0;
  bottom: max(12px, env(safe-area-inset-bottom));
  left: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  pointer-events: none;
}

// Кнопка крупнее точки — в неё легко попасть пальцем
.gallery__dot {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  pointer-events: auto;

  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(#fff, 0.6);
    transition: transform 0.2s, background-color 0.2s;
  }
}

.gallery__dot--current::before {
  background: #fff;
  transform: scale(1.35);
}

// Экраны: лента листается свайпом по экрану целиком, карточки прижаты к верху
// (первый экран из SSR совпадает с собранным скриптом)
@media (max-width: 680px) {
  .gallery {
    overflow: hidden;
  }

  .gallery__pager {
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  // Отступы — у экрана, а не у карточек: от его внутренней высоты считаются ряды
  // (скрипт и обрезка по рядам в CSS)
  .gallery__screen {
    container-type: size;
    min-height: 0;
    overflow: hidden;
    padding-bottom: calc(max($gap, env(safe-area-inset-bottom)) + #{$dots-height});
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }

  // До скрипта весь список — на первом экране; обрезаем по целым рядам (карточка + зазор),
  // как потом разложит скрипт, — неполный ряд не мелькнёт
  .gallery__content {
    max-height: calc(round(down, 100cqh + #{$gap}, #{$card-height} + #{$gap}) - #{$gap});
    margin: 0 auto;
    overflow: hidden;
  }

  .gallery__pagination {
    display: none;
  }
}
</style>
