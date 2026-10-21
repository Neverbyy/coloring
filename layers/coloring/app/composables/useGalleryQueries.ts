import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/vue-query'
import { ARTS_API, artApiPath, type GalleryArt, type GalleryPage } from '../../shared/gallery'
import type { DrawingState } from '../../shared/history'

export const galleryKeys = {
  // Все запросы галереи: страницы и лента
  all: ['coloring', 'gallery'] as const,
  page: (page: number) => ['coloring', 'gallery', page] as const,
  // Все страницы подряд — лента экранов на телефоне
  screens: ['coloring', 'gallery', 'screens'] as const,
  art: (id: string) => ['coloring', 'art', id] as const
}

export const drawingKeys = {
  all: (id: string) => ['coloring', 'drawing', id] as const,
  state: (id: string) => ['coloring', 'drawing', id, 'state'] as const,
  base: (id: string) => ['coloring', 'drawing', id, 'base'] as const
}

// Галерея меняется только действиями игрока (импорт, удаление, рисование), а они сбрасывают кэш
// явно — поэтому страницы долго свежие и при переключении не запрашиваются заново
const GALLERY_STALE_MS = 5 * 60_000

// Страница галереи. fetcher — useRequestFetch (на сервере пробрасывает cookie) или $fetch
function fetchGalleryPage(fetcher: typeof $fetch, page: number): Promise<GalleryPage> {
  return fetcher<GalleryPage>(ARTS_API, { query: { page } })
}

// Ошибки 4xx не временные — повторять запрос бессмысленно
function retryTransient(failureCount: number, error: unknown) {
  const status = errorStatus(error)
  if (status && status >= 400 && status < 500) return false
  return failureCount < 1
}

export function useGalleryPageQuery(page: Ref<number>) {
  // На сервере пробрасывает cookie запроса — понадобится для сессии
  const requestFetch = useRequestFetch()
  const queryClient = useQueryClient()

  const fetchPage = async (value: number) => {
    const data = await fetchGalleryPage(requestFetch, value)
    // Номер вне диапазона сервер заменяет ближайшим — кладём ответ и под фактическую страницу,
    // чтобы после исправления адреса не запрашивать её повторно
    if (data.page !== value) queryClient.setQueryData(galleryKeys.page(data.page), data)
    return data
  }

  const query = useQuery({
    queryKey: computed(() => galleryKeys.page(page.value)),
    queryFn: ({ queryKey }) => fetchPage(queryKey[2]),
    // Пока грузится новая страница, на экране остаётся предыдущая
    placeholderData: keepPreviousData,
    staleTime: GALLERY_STALE_MS,
    retry: retryTransient
  })

  // Следующую страницу подгружаем заранее — переключение без ожидания
  watch(query.data, (data) => {
    if (!import.meta.client || !data || data.page >= data.pageCount) return
    const next = data.page + 1
    queryClient.prefetchQuery({ queryKey: galleryKeys.page(next), queryFn: () => fetchPage(next), staleTime: GALLERY_STALE_MS })
  }, { immediate: true })

  return query
}

// Лента экранов (телефон, планшет): страницы API подгружаются по мере листания.
// Первая страница обычно уже есть — её отдал SSR для обычной галереи
export function useGalleryScreensQuery(enabled: Ref<boolean>) {
  const queryClient = useQueryClient()
  const first = () => queryClient.getQueryData<GalleryPage>(galleryKeys.page(1))

  return useInfiniteQuery({
    queryKey: galleryKeys.screens,
    queryFn: ({ pageParam }) => fetchGalleryPage($fetch, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last: GalleryPage) => last.page < last.pageCount ? last.page + 1 : undefined,
    initialData: () => {
      const page = first()
      return page && { pages: [page], pageParams: [1] }
    },
    initialDataUpdatedAt: () => queryClient.getQueryState(galleryKeys.page(1))?.dataUpdatedAt,
    staleTime: GALLERY_STALE_MS,
    enabled,
    retry: retryTransient
  })
}

type GalleryData = GalleryPage | InfiniteData<GalleryPage>

function galleryArts(data: GalleryData | undefined): GalleryArt[] {
  const pages = data && 'pages' in data ? data.pages : data ? [data] : []
  return pages.flatMap(page => page.items)
}

// Арт из уже загруженных страниц галереи: при переходе из неё страница рисования не ждёт запроса
function findInGallery(queryClient: QueryClient, id: string): { art: GalleryArt, updatedAt: number } | undefined {
  for (const [key, data] of queryClient.getQueriesData<GalleryData>({ queryKey: galleryKeys.all })) {
    const art = galleryArts(data).find(item => item.id === id)
    if (art) return { art, updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

// Изменился состав галереи (импорт, удаление) — обновить все страницы и ленту
export function invalidateGallery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: galleryKeys.all })
}

// Вышли из арта: устарела только страница галереи с ним (прогресс, миниатюра) и он сам,
// остальные страницы остаются в кэше
export function invalidateArt(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: galleryKeys.art(id) })
  queryClient.invalidateQueries({
    queryKey: galleryKeys.all,
    predicate: query => galleryArts(query.state.data as GalleryData | undefined).some(art => art.id === id)
  })
}

export function useArtQuery(id: Ref<string>) {
  const requestFetch = useRequestFetch()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: computed(() => galleryKeys.art(id.value)),
    queryFn: ({ queryKey }) => requestFetch<GalleryArt>(artApiPath(queryKey[2])),
    initialData: () => findInGallery(queryClient, id.value)?.art,
    initialDataUpdatedAt: () => findInGallery(queryClient, id.value)?.updatedAt,
    retry: retryTransient
  })
}

// Пока ответ свежий, повторный вызов (нажатие на карточку → открытие холста) берёт его же
const DRAWING_STALE_MS = 10_000

export interface DrawingData {
  state: DrawingState
  base: Blob | null
}

// Состояние рисунка и базовое изображение — параллельно. Вызывается заранее, по нажатию
// на карточку, и ещё раз холстом: второй вызов берёт уже идущий или полученный ответ
export async function fetchDrawing(queryClient: QueryClient, art: Pick<GalleryArt, 'id' | 'hasBase'>): Promise<DrawingData> {
  const loadBase = () => queryClient.fetchQuery({
    queryKey: drawingKeys.base(art.id),
    queryFn: () => $fetch<Blob>(artApiPath(art.id, '/base'), { responseType: 'blob' }),
    staleTime: DRAWING_STALE_MS
  })
  const [state, base] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: drawingKeys.state(art.id),
      queryFn: () => $fetch<DrawingState>(artApiPath(art.id, '/state')),
      staleTime: DRAWING_STALE_MS
    }),
    art.hasBase ? loadBase() : null
  ])
  // Признак базы в карточке мог устареть (рисунок «запёкся» после загрузки галереи)
  return { state, base: base ?? (state.hasBase ? await loadBase() : null) }
}

// Ушли с холста — в кэше осталось состояние до последних штрихов: при следующем открытии
// нужно свежее
export function forgetDrawing(queryClient: QueryClient, id: string) {
  queryClient.removeQueries({ queryKey: drawingKeys.all(id) })
}
