import { GALLERY_PAGE_SIZE, type GalleryPage } from '../../../../shared/gallery'

export default defineEventHandler((event): GalleryPage => {
  const arts = listGalleryArts()
  const pageCount = Math.max(1, Math.ceil(arts.length / GALLERY_PAGE_SIZE))
  const requested = Number.parseInt(String(getQuery(event).page ?? '1'), 10)
  // Номер вне диапазона не ошибка: отдаём ближайшую существующую страницу
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pageCount)
  const start = (page - 1) * GALLERY_PAGE_SIZE

  return {
    items: arts.slice(start, start + GALLERY_PAGE_SIZE),
    page,
    pageCount,
    total: arts.length
  }
})
