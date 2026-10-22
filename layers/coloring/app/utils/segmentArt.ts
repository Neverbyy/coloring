import type { PaperGeometry } from '../../shared/history'
import { context2d, createCanvas } from '../engine/canvas'
import { buildSegmentMap, type SegmentMap } from '../engine/segmentation'

export function segmentArt(image: HTMLImageElement, paper: PaperGeometry): SegmentMap {
  const { width, height, art } = paper
  const context = context2d(createCanvas(width, height), { willReadFrequently: true })
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, art.x, art.y, art.width, art.height)
  return buildSegmentMap(context.getImageData(0, 0, width, height).data, width, height)
}

export function paintableAreas(map: SegmentMap): number {
  return map.segments.filter(segment => !segment.background).length
}
