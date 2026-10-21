import type { GalleryArt, GalleryPage } from '../../shared/gallery'

// Телефоны и узкие планшеты: вместо пагинации — экраны, которые листаются свайпом
const SWIPE_QUERY = '(max-width: 680px)'

export type GalleryEntry =
  | { key: string, kind: 'import' }
  | { key: string, kind: 'art', art: GalleryArt }
  // Карточка ещё не загруженной страницы
  | { key: string, kind: 'placeholder' }

// Галерея экранами: карточка «+» и арты, разложенные по экранам ленты.
// pager — прокручиваемая лента; каждый её ребёнок — экран с сеткой .gallery__grid.
// page — страница обычной галереи: её показывают на широком экране, а до монтирования (и на
// сервере) она же — первый экран ленты: swipe = false, раскладку задаёт CSS, и первый экран
// совпадает с тем, что потом соберёт скрипт, — без скачка
export function useGalleryScreens(pager: Ref<HTMLElement | null>, page: Ref<GalleryPage | undefined>) {
  const swipe = useMediaQuery(SWIPE_QUERY)
  const screensQuery = useGalleryScreensQuery(swipe)
  // Карточек на экране: колонки сетки × ряды, что влезают по высоте; 0 — ещё не измерено
  const perScreen = ref(0)
  // Первая карточка видимого экрана — при возврате из арта и смене размера экрана остаёмся на месте
  const firstEntry = useState('coloring:gallery-first-entry', () => 0)
  const currentScreen = computed(() => perScreen.value ? Math.floor(firstEntry.value / perScreen.value) : 0)

  const arts = computed<GalleryArt[]>(() => {
    const pages = swipe.value ? screensQuery.data.value?.pages : undefined
    if (!pages) return page.value?.items ?? []
    // Пока подгружались страницы, галерея могла сдвинуться — без повторов
    const seen = new Set<string>()
    return pages.flatMap(item => item.items).filter(art => !seen.has(art.id) && Boolean(seen.add(art.id)))
  })
  const total = computed(() => {
    const pages = swipe.value ? screensQuery.data.value?.pages : undefined
    return pages?.at(-1)?.total ?? page.value?.total ?? arts.value.length
  })

  const screens = computed<GalleryEntry[][]>(() => {
    const entries: GalleryEntry[] = [
      { key: 'import', kind: 'import' },
      ...arts.value.map(art => ({ key: art.id, kind: 'art' as const, art }))
    ]
    const per = perScreen.value
    if (!swipe.value || per === 0) return [entries]

    // Экранов — сколько нужно на все арты; ещё не загруженные карточки — заглушки
    const count = Math.max(1, Math.ceil((total.value + 1) / per), Math.ceil(entries.length / per))
    return Array.from({ length: count }, (_, index) => {
      const screen = entries.slice(index * per, (index + 1) * per)
      const missing = Math.min(per, total.value + 1 - index * per) - screen.length
      for (let i = 0; i < missing; i++) screen.push({ key: `placeholder-${index}-${i}`, kind: 'placeholder' })
      return screen
    })
  })

  function goToScreen(index: number, smooth: boolean) {
    const element = pager.value
    if (!element) return
    element.scrollTo({ left: index * element.clientWidth, behavior: smooth ? 'smooth' : 'instant' })
  }

  // Новый арт — первый в ленте: к первому экрану
  function showFirst() {
    firstEntry.value = 0
    goToScreen(0, true)
  }

  // Сколько карточек влезает: колонки — из CSS-сетки, ряды — по высоте экрана
  function measure() {
    const screen = pager.value?.firstElementChild
    const grid = screen?.querySelector('.gallery__grid')
    const card = grid?.firstElementChild
    if (!swipe.value || !screen || !grid || !card) {
      perScreen.value = 0
      return
    }
    const screenStyle = getComputedStyle(screen)
    const gridStyle = getComputedStyle(grid)
    const height = screen.clientHeight - Number.parseFloat(screenStyle.paddingTop) - Number.parseFloat(screenStyle.paddingBottom)
    const gap = Number.parseFloat(gridStyle.rowGap) || 0
    const columns = gridStyle.gridTemplateColumns.split(' ').length
    const rows = Math.max(1, Math.floor((height + gap) / (card.getBoundingClientRect().height + gap)))
    const per = columns * rows
    if (per === perScreen.value) return
    perScreen.value = per
    // Остаёмся на экране с той же первой карточкой
    nextTick(() => goToScreen(Math.floor(firstEntry.value / per), false))
  }

  // Страницы API — заранее, на экран вперёд
  function loadAhead() {
    if (!swipe.value || !perScreen.value) return
    const needed = Math.min((currentScreen.value + 2) * perScreen.value - 1, total.value)
    const { hasNextPage, isFetchingNextPage, fetchNextPage } = screensQuery
    if (arts.value.length < needed && hasNextPage.value && !isFetchingNextPage.value) fetchNextPage()
  }

  function onScroll() {
    const element = pager.value
    if (!element || !perScreen.value) return
    firstEntry.value = Math.round(element.scrollLeft / element.clientWidth) * perScreen.value
    loadAhead()
  }

  let observer: ResizeObserver | undefined
  onMounted(() => {
    observer = new ResizeObserver(() => measure())
    if (pager.value) observer.observe(pager.value)
  })
  onBeforeUnmount(() => observer?.disconnect())
  watch(swipe, () => nextTick(measure))
  watch(() => screensQuery.data.value, loadAhead)

  return { swipe, screens, currentScreen, goToScreen, showFirst, onScroll }
}
