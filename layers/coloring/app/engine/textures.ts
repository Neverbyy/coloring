import type { StrokeTool } from '#layers/coloring/shared/history'
import { context2d, createCanvas } from './canvas'

export interface ToolStyle {
  width: number
  textured: boolean
}

export const TOOL_STYLES: Record<StrokeTool, ToolStyle> = {
  brush: { width: 34, textured: false },
  pencil: { width: 12, textured: true },
  eraser: { width: 40, textured: false }
}

const TEXTURE_SIZE = 256
const GRAIN_LIGHT = 0.6
const GRAIN_DARK = 0.3
const GRAIN_SHAPE = 1.6
const SPARKLE_CHANCE = 0.008
const SPARKLE_ALPHA = 0.9

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let textureTile: HTMLCanvasElement | null = null

function drawTextureTile(): HTMLCanvasElement {
  const tile = createCanvas(TEXTURE_SIZE, TEXTURE_SIZE)
  const tileContext = context2d(tile)
  const image = tileContext.createImageData(TEXTURE_SIZE, TEXTURE_SIZE)
  const random = mulberry32(20261021)

  for (let i = 0; i < TEXTURE_SIZE * TEXTURE_SIZE; i++) {
    const value = random() * 2 - 1
    const strength = Math.abs(value) ** GRAIN_SHAPE
    let light = value > 0
    let alpha = strength * (light ? GRAIN_LIGHT : GRAIN_DARK)
    if (random() < SPARKLE_CHANCE) {
      light = true
      alpha = SPARKLE_ALPHA
    }
    const offset = i * 4
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = light ? 255 : 0
    image.data[offset + 3] = Math.round(alpha * 255)
  }

  tileContext.putImageData(image, 0, 0)
  return tile
}

export function createPencilTexture(context: CanvasRenderingContext2D): CanvasPattern {
  textureTile ??= drawTextureTile()
  return context.createPattern(textureTile, 'repeat')!
}
