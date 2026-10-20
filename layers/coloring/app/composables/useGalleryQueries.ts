import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import type { GalleryArt, GalleryPage } from '../../shared/gallery'
import type { DrawingState } from '../../shared/history'

export const galleryKeys = {
  page: (page: number) => ['coloring', 'gallery', page] as const,
  art: (id: string) => ['coloring', 'art', id] as const
}

export const drawingKeys = {
  all: (id: string) => ['coloring', 'drawing', id] as const,
  state: (id: string) => ['coloring', 'drawing', id, 'state'] as const,
  base: (id: string) => ['coloring', 'drawing', id, 'base'] as const
}

// Адреса API рисунка — в одном месте
export function drawingUrl(id: string, path = ''): string {
  return `/api/coloring/arts/${encodeURIComponent(id)}${path}`
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
    const data = await requestFetch<GalleryPage>('/api/coloring/arts', { query: { page: value } })
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
    retry: retryTransient
  })

  // Следующую страницу подгружаем заранее — переключение без ожидания
  watch(query.data, (data) => {
    if (!import.meta.client || !data || data.page >= data.pageCount) return
    const next = data.page + 1
    queryClient.prefetchQuery({ queryKey: galleryKeys.page(next), queryFn: () => fetchPage(next) })
  }, { immediate: true })

  return query
}

// Арт из уже загруженных страниц галереи: при переходе из неё страница рисования не ждёт запроса
function findInGallery(queryClient: QueryClient, id: string): { art: GalleryArt, updatedAt: number } | undefined {
  for (const [key, page] of queryClient.getQueriesData<GalleryPage>({ queryKey: ['coloring', 'gallery'] })) {
    const art = page?.items.find(item => item.id === id)
    if (art) return { art, updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export function useArtQuery(id: Ref<string>) {
  const requestFetch = useRequestFetch()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: computed(() => galleryKeys.art(id.value)),
    queryFn: ({ queryKey }) => requestFetch<GalleryArt>(drawingUrl(queryKey[2])),
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
    queryFn: () => $fetch<Blob>(drawingUrl(art.id, '/base'), { responseType: 'blob' }),
    staleTime: DRAWING_STALE_MS
  })
  const [state, base] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: drawingKeys.state(art.id),
      queryFn: () => $fetch<DrawingState>(drawingUrl(art.id, '/state')),
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
