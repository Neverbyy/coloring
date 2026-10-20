import { GALLERY_PAGE_SIZE, type GalleryPage } from '../../../../shared/gallery'

export default defineEventHandler(async (event): Promise<GalleryPage> => {
  const user = await requireUser(event)
  const requested = Number.parseInt(String(getQuery(event).page ?? '1'), 10)
  let page = Number.isFinite(requested) && requested > 0 ? requested : 1

  // Обычно — один запрос: страница вместе с общим числом артов
  let { items, total } = await listGalleryArts(user.id, (page - 1) * GALLERY_PAGE_SIZE, GALLERY_PAGE_SIZE)

  // Номер вне диапазона не ошибка: отдаём последнюю существующую страницу
  if (total === null) {
    const all = await countGalleryArts()
    const last = Math.max(1, Math.ceil(all / GALLERY_PAGE_SIZE))
    if (page > last) {
      page = last
      ;({ items, total } = await listGalleryArts(user.id, (page - 1) * GALLERY_PAGE_SIZE, GALLERY_PAGE_SIZE))
    }
    total ??= all
  }

  return {
    items,
    page,
    pageCount: Math.max(1, Math.ceil(total / GALLERY_PAGE_SIZE)),
    total
  }
})
