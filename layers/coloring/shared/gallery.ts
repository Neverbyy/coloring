export const ARTS_API = '/api/coloring/arts'

export function artApiPath(id: string, path = ''): string {
  return `${ARTS_API}/${encodeURIComponent(id)}${path}`
}

export interface GalleryArt {
  id: string
  title: string
  image: string
  width: number
  height: number
  progress: number
  thumbnail: string | null
  hasBase: boolean
  own: boolean
  isNew: boolean
}

export interface GalleryPage {
  items: GalleryArt[]
  page: number
  pageCount: number
  total: number
}

export const GALLERY_PAGE_SIZE = 11

export const GALLERY_SIGNAL = { channel: 'coloring-gallery', event: 'changed' } as const

export const MAX_SVG_BYTES = 1024 * 1024
export const MAX_OWN_ARTS = 50
export const MAX_ART_TITLE = 40

export const IMPORT_MESSAGES = {
  notSvg: 'Можно загрузить только SVG-файл',
  empty: 'Файл пустой',
  tooBig: 'Файл слишком большой — до 1 МБ'
}

export interface ImportResult {
  art: GalleryArt
  notes: string[]
}
