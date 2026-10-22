<script setup lang="ts">
import { paperGeometry } from '#layers/coloring/shared/history'
import type { SegmentMap } from '#layers/coloring/app/engine/segmentation'

const props = defineProps<{ image: string, width: number, height: number }>()
const emit = defineEmits<{ analyzed: [areas: number] }>()

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const failed = ref(false)

const LINE: readonly number[] = [32, 15, 96]
const BACKGROUND: readonly number[] = [226, 232, 240]

function areaColor(index: number): number[] {
  const hue = (index * 137.508) % 360
  const s = 0.65
  const l = 0.72
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function draw(map: SegmentMap, art: { x: number, y: number, width: number, height: number }) {
  const target = canvas.value
  if (!target) return
  target.width = art.width
  target.height = art.height
  const context = target.getContext('2d')
  if (!context) return
  const colors = map.segments.map((segment, index) => segment.background ? BACKGROUND : areaColor(index))
  const image = context.createImageData(art.width, art.height)
  for (let y = 0; y < art.height; y++) {
    const row = (art.y + y) * map.width + art.x
    for (let x = 0; x < art.width; x++) {
      const id = map.labels[row + x]!
      const color = id < 0 ? LINE : colors[id]!
      const offset = (y * art.width + x) * 4
      image.data[offset] = color[0]!
      image.data[offset + 1] = color[1]!
      image.data[offset + 2] = color[2]!
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
}

onMounted(async () => {
  try {
    const paper = paperGeometry(props.width, props.height)
    const map = segmentArt(await loadImage(props.image), paper)
    draw(map, paper.art)
    emit('analyzed', paintableAreas(map))
  } catch {
    failed.value = true
    emit('analyzed', 0)
  }
})
</script>

<template>
  <div class="segments-preview" :style="{ aspectRatio: `${width} / ${height}` }">
    <p v-if="failed" class="admin-error">Не удалось разобрать картинку</p>
    <canvas v-else ref="canvas" class="segments-preview__canvas" />
  </div>
</template>

<style scoped lang="scss">
.segments-preview {
  display: grid;
  place-items: center;
  width: 100%;
}

.segments-preview__canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
