// Общие для клиента и сервера типы галереи

export interface GalleryArt {
  id: string
  title: string
  image: string
  progress: number
  // Импортирован пользователем — можно удалить
  own: boolean
}

export interface GalleryPage {
  items: GalleryArt[]
  page: number
  pageCount: number
  total: number
}

// На странице 12 карточек: карточка импорта и 11 артов
export const GALLERY_PAGE_SIZE = 11
