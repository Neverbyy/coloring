// Общие для клиента и сервера типы галереи

export const ARTS_API = '/api/coloring/arts'

// Адрес API арта: /api/coloring/arts/<id><path> — для запросов клиента и ссылок, которые строит сервер
export function artApiPath(id: string, path = ''): string {
  return `${ARTS_API}/${encodeURIComponent(id)}${path}`
}

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

// Импорт своего SVG
export const MAX_SVG_BYTES = 1024 * 1024
export const MAX_OWN_ARTS = 50

// Одни и те же тексты проверяет и браузер (до загрузки), и сервер
export const IMPORT_MESSAGES = {
  notSvg: 'Можно загрузить только SVG-файл',
  empty: 'Файл пустой',
  tooBig: 'Файл слишком большой — до 1 МБ'
}

export interface ImportResult {
  art: GalleryArt
  // Что пришлось пропустить при подготовке (текст, вставленные картинки) — показать игроку
  notes: string[]
}
