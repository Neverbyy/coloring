import { paperGeometry } from '../../shared/history'

export function paperLayout(artWidth: number, artHeight: number) {
  const { width, height, art } = paperGeometry(artWidth, artHeight)
  return {
    left: `${-art.x / art.width * 100}%`,
    top: `${-art.y / art.height * 100}%`,
    width: `${width / art.width * 100}%`,
    height: `${height / art.height * 100}%`
  }
}
