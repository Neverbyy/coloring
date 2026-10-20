// Общие для клиента и сервера типы галереи

export interface GalleryArt {
  id: string
  title: string
  image: string
  width: number
  height: number
  // Процент заполнения у текущего игрока, 0–100
  progress: number
  // Миниатюра рисунка игрока (адрес с версией); null — ещё не рисовал
  thumbnail: string | null
  // У рисунка есть базовое изображение — его можно запрашивать сразу, вместе с состоянием
  hasBase: boolean
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
