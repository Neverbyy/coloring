<script setup lang="ts">
definePageMeta({ music: '/sounds/main-theme.mp3' })
useHead({ title: 'Игры' })

type HubItem = { kind: 'game', game: GameEntry } | { kind: 'soon' }

const PAGE_SIZE = 6
const PAGE_LEAVE_MS = 140
const PAGE_ENTER_MS = 450

const { games } = useAppConfig()
const auth = useAuthStore()
const route = useRoute()

const items = computed<HubItem[]>(() => [
  ...games.map(game => ({ kind: 'game' as const, game })),
  ...(games.length === 1 ? [{ kind: 'soon' as const }] : [])
])
const pageCount = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)))
const page = computed(() => {
  const value = Number.parseInt(String(route.query.page ?? '1'), 10)
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), pageCount.value) : 1
})
const pageStart = computed(() => (page.value - 1) * PAGE_SIZE)

const router = useRouter()
watch(page, (actual) => {
  if (route.query.page !== undefined && String(actual) !== route.query.page) {
    router.replace({ query: { ...route.query, page: actual === 1 ? undefined : String(actual) } })
  }
}, { immediate: true })

const pageTransition = ref('hub-page-next')
watch(page, (next, previous) => {
  pageTransition.value = next >= previous ? 'hub-page-next' : 'hub-page-prev'
})

function onPage(index: number): boolean {
  return index >= pageStart.value && index < pageStart.value + PAGE_SIZE
}

const strip = ref<HTMLElement | null>(null)
const current = ref(0)

function onStripScroll() {
  const element = strip.value
  if (element?.clientWidth) current.value = Math.round(element.scrollLeft / element.clientWidth)
}

function showSlide(index: number) {
  const element = strip.value
  element?.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
}
</script>

<template>
  <main class="hub">
    <div class="hub__toolbar">
      <LogoutButton />
      <MusicToggle />
    </div>

    <div class="hub__content">
      <header class="hub__header">
        <h1 class="hub__title">Во что поиграем?</h1>
        <p v-if="auth.user" class="hub__greeting">Привет, {{ auth.user.username }}!</p>
      </header>

      <Transition :name="pageTransition" mode="out-in" :duration="{ enter: PAGE_ENTER_MS, leave: PAGE_LEAVE_MS }">
        <ul :key="`page-${page}`" ref="strip" class="hub__games" @scroll.passive="onStripScroll">
          <li
            v-for="(item, index) in items"
            :key="item.kind === 'game' ? item.game.id : 'soon'"
            class="hub__game"
            :class="{ 'hub__game--other-page': !onPage(index) }"
            :style="{ '--i': index - pageStart }"
          >
            <NuxtLink v-if="item.kind === 'game'" class="hub-card" :to="item.game.to">
              <span class="hub-card__cover">
                <img :src="item.game.cover" alt="" draggable="false">
              </span>
              <span class="hub-card__title">{{ item.game.title }}</span>
            </NuxtLink>
            <div v-else class="hub-card hub-card--soon" aria-label="Скоро новые игры">
              <span class="hub-card__cover hub-card__cover--soon" aria-hidden="true">?</span>
              <span class="hub-card__title">Скоро</span>
            </div>
          </li>
        </ul>
      </Transition>

      <div v-if="pageCount > 1" class="hub__pagination">
        <Pagination :page="page" :page-count="pageCount" label="Страницы игр" />
      </div>

      <nav v-if="items.length > 1" class="hub__dots" aria-label="Игры">
        <button
          v-for="index in items.length"
          :key="index"
          type="button"
          class="hub__dot"
          :class="{ 'hub__dot--current': index - 1 === current }"
          :aria-label="`Карточка ${index}`"
          :aria-current="index - 1 === current ? 'true' : undefined"
          @click="showSlide(index - 1)"
        />
      </nav>
    </div>
  </main>
</template>

<style scoped lang="scss">
$gap: 24px;
$toolbar-size: 56px;
$card-width: 260px;
$grid-gap: 32px;
$wide-screen: 1800px;

.hub {
  --card: clamp(160px, min((100dvh - 460px) / 2, (100vw - 112px) / 3), #{$card-width});

  position: fixed;
  inset: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: $color-sky;

  @media (min-width: $wide-screen) {
    --card: #{$card-width};
  }
}

.hub__toolbar {
  position: fixed;
  top: max($gap, env(safe-area-inset-top));
  left: max($gap, env(safe-area-inset-left));
  z-index: 5;
  display: flex;
  gap: 12px;
}

.hub__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  min-height: 100%;
  padding:
    calc(max($gap, env(safe-area-inset-top)) + #{$toolbar-size + 24px})
    max($gap, env(safe-area-inset-right))
    max($gap, env(safe-area-inset-bottom))
    max($gap, env(safe-area-inset-left));

  @include phone-portrait {
    gap: 24px;
  }
}

.hub__header {
  text-align: center;
}

.hub__title {
  font-family: $font-display;
  font-size: 48px;
  font-weight: 400;
  line-height: 1.1;
  color: $color-ink;

  @include phone-portrait {
    font-size: 34px;
  }
}

.hub__greeting {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 700;
  color: $color-ink;
  opacity: 0.7;
}

.hub__games {
  display: grid;
  grid-template-columns: repeat(auto-fit, var(--card));
  justify-content: center;
  gap: $grid-gap;
  width: 100%;
  max-width: calc(3 * var(--card) + 2 * #{$grid-gap});

  @media (min-width: $wide-screen) {
    max-width: calc(6 * var(--card) + 5 * #{$grid-gap});
  }

  @include phone-portrait {
    display: flex;
    justify-content: flex-start;
    max-width: none;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    gap: 0;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
}

.hub__game {
  min-width: 0;

  @include phone-portrait {
    display: flex;
    flex: 0 0 100%;
    justify-content: center;
    scroll-snap-align: center;
    scroll-snap-stop: always;

    .hub-card {
      width: min($card-width, 100%);
    }
  }
}

.hub__game--other-page {
  display: none;

  @include phone-portrait {
    display: flex;
  }
}

.hub__pagination {
  @include phone-portrait {
    display: none;
  }
}

.hub__dots {
  display: none;

  @include phone-portrait {
    display: flex;
    justify-content: center;
    margin-top: -12px;
  }
}

.hub__dot {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;

  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(#fff, 0.6);
    transition: transform 0.2s, background-color 0.2s;
  }
}

.hub__dot--current::before {
  background: #fff;
  transform: scale(1.35);
}

.hub-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: $color-ink;
  text-decoration: none;
  outline: none;
  transition: transform 0.25s $lift-easing;

  &:focus-visible .hub-card__cover {
    @include frame-focus;
  }
}

a.hub-card {
  @include pressable;

  @include on-hover {
    transform: translateY(-6px);
  }
}

.hub-card__cover {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  @include frame-card;

  img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.hub-card__cover--soon {
  background: $color-board;
  color: $color-sky;
  font: 96px/1 $font-display;
}

.hub-card__title {
  max-width: 100%;
  overflow: hidden;
  font-family: $font-display;
  font-size: min(30px, calc(var(--card) * 0.12));
  line-height: 1.1;
  white-space: nowrap;
  text-overflow: ellipsis;

  @include phone-portrait {
    font-size: 30px;
  }
}

.hub-card--soon {
  opacity: 0.6;
  cursor: default;
}

.hub-page-next-leave-active,
.hub-page-prev-leave-active {
  transition: opacity 0.14s ease-in, transform 0.14s ease-in;
}

.hub-page-next-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.hub-page-prev-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.hub-page-next-enter-active > li,
.hub-page-prev-enter-active > li {
  animation: hub-card-in 0.28s $lift-easing both;
  animation-delay: calc(var(--i) * 15ms);
}

.hub-page-prev-enter-active > li {
  animation-name: hub-card-in-back;
}

@keyframes hub-card-in {
  from {
    opacity: 0;
    transform: translateX(32px) scale(0.94);
  }
}

@keyframes hub-card-in-back {
  from {
    opacity: 0;
    transform: translateX(-32px) scale(0.94);
  }
}
</style>
