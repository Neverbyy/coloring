import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { GalleryArt, GalleryPage } from '../../shared/gallery'

export const galleryKeys = {
  page: (page: number) => ['coloring', 'gallery', page] as const,
  art: (id: string) => ['coloring', 'art', id] as const
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

export function useArtQuery(id: Ref<string>) {
  const requestFetch = useRequestFetch()

  return useQuery({
    queryKey: computed(() => galleryKeys.art(id.value)),
    queryFn: ({ queryKey }) => requestFetch<GalleryArt>(`/api/coloring/arts/${encodeURIComponent(queryKey[2])}`),
    retry: retryTransient
  })
}
