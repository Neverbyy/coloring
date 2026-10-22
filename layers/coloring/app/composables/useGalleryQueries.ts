import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/vue-query'
import { ARTS_API, artApiPath, type GalleryArt, type GalleryPage } from '#layers/coloring/shared/gallery'
import type { DrawingState } from '#layers/coloring/shared/history'

export const galleryKeys = {
  all: ['coloring', 'gallery'] as const,
  page: (page: number) => ['coloring', 'gallery', page] as const,
  screens: ['coloring', 'gallery', 'screens'] as const,
  art: (id: string) => ['coloring', 'art', id] as const
}

export const drawingKeys = {
  all: (id: string) => ['coloring', 'drawing', id] as const,
  state: (id: string) => ['coloring', 'drawing', id, 'state'] as const,
  base: (id: string) => ['coloring', 'drawing', id, 'base'] as const
}

const GALLERY_STALE_MS = 5 * 60_000

function fetchGalleryPage(fetcher: typeof $fetch, page: number): Promise<GalleryPage> {
  return fetcher<GalleryPage>(ARTS_API, { query: { page } })
}

function retryTransient(failureCount: number, error: unknown) {
  const status = errorStatus(error)
  if (status && status >= 400 && status < 500) return false
  return failureCount < 1
}

export function useGalleryPageQuery(page: Ref<number>) {
  const requestFetch = useRequestFetch()
  const queryClient = useQueryClient()

  const fetchPage = async (value: number) => {
    const data = await fetchGalleryPage(requestFetch, value)
    if (data.page !== value) queryClient.setQueryData(galleryKeys.page(data.page), data)
    return data
  }

  const query = useQuery({
    queryKey: computed(() => galleryKeys.page(page.value)),
    queryFn: ({ queryKey }) => fetchPage(queryKey[2]),
    placeholderData: keepPreviousData,
    staleTime: GALLERY_STALE_MS,
    retry: retryTransient
  })

  watch(query.data, (data) => {
    if (!import.meta.client || !data || data.page >= data.pageCount) return
    const next = data.page + 1
    queryClient.prefetchQuery({ queryKey: galleryKeys.page(next), queryFn: () => fetchPage(next), staleTime: GALLERY_STALE_MS })
  }, { immediate: true })

  return query
}

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

function findInGallery(queryClient: QueryClient, id: string): { art: GalleryArt, updatedAt: number } | undefined {
  for (const [key, data] of queryClient.getQueriesData<GalleryData>({ queryKey: galleryKeys.all })) {
    const art = galleryArts(data).find(item => item.id === id)
    if (art) return { art, updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export function invalidateGallery(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: galleryKeys.all })
}

export function markArtSeen(queryClient: QueryClient, id: string) {
  const seen = (page: GalleryPage): GalleryPage => page.items.some(art => art.id === id && art.isNew)
    ? { ...page, items: page.items.map(art => art.id === id ? { ...art, isNew: false } : art) }
    : page
  queryClient.setQueriesData<GalleryData>({ queryKey: galleryKeys.all }, data =>
    !data ? data : 'pages' in data ? { ...data, pages: data.pages.map(seen) } : seen(data)
  )
}

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

const DRAWING_STALE_MS = 10_000

export interface DrawingData {
  state: DrawingState
  base: Blob | null
}

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
  return { state, base: base ?? (state.hasBase ? await loadBase() : null) }
}

export function forgetDrawing(queryClient: QueryClient, id: string) {
  queryClient.removeQueries({ queryKey: drawingKeys.all(id) })
}
