import { STICKERS, type StickerId } from '#layers/coloring/shared/history'
import type { StickerImages } from '#layers/coloring/app/engine/engine'
import { loadImage } from './loadImage'
import butterfly from '../assets/stickers/butterfly.webp'
import flower from '../assets/stickers/flower.webp'
import heart from '../assets/stickers/heart.webp'
import ladybug from '../assets/stickers/ladybug.webp'
import rainbow from '../assets/stickers/rainbow.webp'
import star from '../assets/stickers/star.webp'

export const STICKER_IMAGES = { heart, star, flower, butterfly, ladybug, rainbow } satisfies Record<StickerId, string>

export const STICKER_LABELS = {
  heart: 'Сердечко',
  star: 'Звёздочка',
  flower: 'Цветок',
  butterfly: 'Бабочка',
  ladybug: 'Божья коровка',
  rainbow: 'Радуга'
} satisfies Record<StickerId, string>

export async function loadStickers(): Promise<StickerImages> {
  const images = await Promise.all(STICKERS.map(id => loadImage(STICKER_IMAGES[id])))
  return new Map(STICKERS.map((id, index) => [id, images[index]!]))
}
