import type { StrokeTool } from '../../shared/history'
import { context2d, createCanvas } from './canvas'

export interface ToolStyle {
  // Толщина линии в точках рисунка (длинная сторона — 1024)
  width: number
  // Непрозрачность штриха
  alpha: number
  // Зерно бумаги — фактура карандаша
  grain: boolean
}

// Кисть — широкая, сплошная, непрозрачная, как гуашь. Карандаш — тонкий, полупрозрачный, с зерном
export const TOOL_STYLES: Record<StrokeTool, ToolStyle> = {
  brush: { width: 34, alpha: 1, grain: false },
  pencil: { width: 12, alpha: 0.9, grain: true },
  eraser: { width: 40, alpha: 1, grain: false }
}

const GRAIN_SIZE = 96
// Зерно не должно делать штрих дырявым: самые светлые точки — 30% непрозрачности
const GRAIN_MIN_ALPHA = 0.3

// Детерминированный генератор: зерно одинаковое при каждом запуске, и повтор истории
// (отмена, перезагрузка) рисует ровно ту же картинку
function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Маска зерна: прозрачность каждой точки случайна, цвет не важен (используется как destination-in)
export function createGrainPattern(context: CanvasRenderingContext2D): CanvasPattern {
  const tile = createCanvas(GRAIN_SIZE, GRAIN_SIZE)
  const tileContext = context2d(tile)
  const image = tileContext.createImageData(GRAIN_SIZE, GRAIN_SIZE)
  const random = mulberry32(20261020)

  for (let i = 0; i < GRAIN_SIZE * GRAIN_SIZE; i++) {
    // Лёгкие горизонтальные «волокна» бумаги плюс случайный шум
    const y = Math.floor(i / GRAIN_SIZE)
    const fibre = 0.15 * Math.sin(y * 1.7)
    const noise = Math.pow(random(), 0.9)
    const alpha = Math.min(1, GRAIN_MIN_ALPHA + (1 - GRAIN_MIN_ALPHA) * noise + fibre)
    image.data[i * 4 + 3] = Math.round(Math.max(GRAIN_MIN_ALPHA, alpha) * 255)
  }

  tileContext.putImageData(image, 0, 0)
  return context.createPattern(tile, 'repeat')!
}
