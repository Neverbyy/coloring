import { GALLERY_PAGE_SIZE, type GalleryPage } from '../../../../shared/gallery'

export default defineEventHandler(async (event): Promise<GalleryPage> => {
  await requireUser(event)
  const total = await countGalleryArts()
  const pageCount = Math.max(1, Math.ceil(total / GALLERY_PAGE_SIZE))
  const requested = Number.parseInt(String(getQuery(event).page ?? '1'), 10)
  // Номер вне диапазона не ошибка: отдаём ближайшую существующую страницу
  const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), pageCount)

  return {
    items: await listGalleryArts((page - 1) * GALLERY_PAGE_SIZE, GALLERY_PAGE_SIZE),
    page,
    pageCount,
    total
  }
})
