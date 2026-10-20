import { paperGeometry } from '../../shared/history'

// Положение бумаги (картинка + поля) относительно контейнера размером с картинку, в процентах:
// картинка вписана в рамку, поля выходят за неё во все стороны, лишнее обрезает рамка.
// Так раскладываются и холст на экране рисования, и миниатюра в галерее
export function paperLayout(artWidth: number, artHeight: number) {
  const { width, height, art } = paperGeometry(artWidth, artHeight)
  return {
    left: `${-art.x / art.width * 100}%`,
    top: `${-art.y / art.height * 100}%`,
    width: `${width / art.width * 100}%`,
    height: `${height / art.height * 100}%`
  }
}
