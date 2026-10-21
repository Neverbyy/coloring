// Звуки игры «Раскраска». Громкость выровнена по замерам записей (RMS): карандаш и ластик
// записаны тихо — их усиливаем, музыка громкая — её играет платформа тише эффектов

export const COLORING_MUSIC = '/sounds/main-theme.mp3'

export const COLORING_SOUNDS = {
  // Звучат, только пока игрок ведёт инструментом по холсту
  brush: { src: '/sounds/brush_sound.mp3', volume: 0.55 },
  pencil: { src: '/sounds/pencil_sound.mp3', volume: 0.55 },
  eraser: { src: '/sounds/eraser_sound.mp3', volume: 0.55 },
  // Рисунок закрашен на 100%
  success: { src: '/sounds/success-art_sound.mp3', volume: 0.7 }
}
