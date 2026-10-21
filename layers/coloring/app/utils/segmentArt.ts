import type { PaperGeometry } from '../../shared/history'
import { context2d, createCanvas } from '../engine/canvas'
import { buildSegmentMap, type SegmentMap } from '../engine/segmentation'

// Разметка сегментов: картинка на белой бумаге. Поля бумаги соединяются с фоном картинки —
// это один сегмент фона, его можно красить во всей рамке.
// Общая для холста и проверки импорта — чтобы импорт видел те же области, что и раскраска
export function segmentArt(image: HTMLImageElement, paper: PaperGeometry): SegmentMap {
  const { width, height, art } = paper
  const context = context2d(createCanvas(width, height), { willReadFrequently: true })
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, art.x, art.y, art.width, art.height)
  return buildSegmentMap(context.getImageData(0, 0, width, height).data, width, height)
}
