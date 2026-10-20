import type { GalleryArt } from '../../shared/gallery'

// Заглушка до базы данных: три базовых арта без прогресса
const BASE_ARTS: readonly GalleryArt[] = [
  { id: 'octopus', title: 'Осьминог', image: '/arts/octopus.png', progress: 0, own: false },
  { id: 'cat', title: 'Кошка', image: '/arts/cat.png', progress: 0, own: false },
  { id: 'house', title: 'Дом', image: '/arts/house.png', progress: 0, own: false }
]

export function listGalleryArts(): readonly GalleryArt[] {
  return BASE_ARTS
}

export function findGalleryArt(id: string): GalleryArt | undefined {
  return BASE_ARTS.find(art => art.id === id)
}
