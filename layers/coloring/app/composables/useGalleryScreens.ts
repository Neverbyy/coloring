import type { GalleryArt, GalleryPage } from '#layers/coloring/shared/gallery'

const SWIPE_QUERY = '(max-width: 680px)'

export type GalleryEntry =
  | { key: string, kind: 'import' }
  | { key: string, kind: 'art', art: GalleryArt }
  | { key: string, kind: 'placeholder' }

export function useGalleryScreens(pager: Ref<HTMLElement | null>, page: Ref<GalleryPage | undefined>) {
  const swipe = useMediaQuery(SWIPE_QUERY)
  const screensQuery = useGalleryScreensQuery(swipe)
  const perScreen = ref(0)
  const firstEntry = useState('coloring:gallery-first-entry', () => 0)
  const currentScreen = computed(() => perScreen.value ? Math.floor(firstEntry.value / perScreen.value) : 0)

  const arts = computed<GalleryArt[]>(() => {
    const pages = swipe.value ? screensQuery.data.value?.pages : undefined
    if (!pages) return page.value?.items ?? []
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

  function showEntry(index: number) {
    const per = perScreen.value
    const screen = per ? Math.floor(index / per) : 0
    firstEntry.value = screen * per
    nextTick(() => goToScreen(screen, true))
  }

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
    nextTick(() => goToScreen(Math.floor(firstEntry.value / per), false))
  }

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

  return { swipe, screens, currentScreen, goToScreen, showEntry, onScroll }
}
