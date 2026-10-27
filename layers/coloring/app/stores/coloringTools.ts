import { STROKE_OPACITY_RANGE, STROKE_WIDTH_RANGES, type PaintTool, type StrokeTool } from '#layers/coloring/shared/history'

export type ColoringTool = StrokeTool
export type DrawingTool = PaintTool

export const COLORING_TOOLS: readonly ColoringTool[] = ['brush', 'pencil', 'eraser']

export const COLORING_TOOL_LABELS: Record<ColoringTool, string> = {
  brush: 'Кисть',
  pencil: 'Карандаш',
  eraser: 'Ластик'
}

const RECENT_COLORS_LIMIT = 2

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const useColoringToolsStore = defineStore('coloring-tools', () => {
  const tool = ref<ColoringTool>('brush')
  const lastDrawingTool = ref<DrawingTool>('brush')
  const color = ref('#1C41E8')
  const recentColors = ref<string[]>(['#12ABEC', '#EC12AB'])
  const paletteOpen = ref(false)
  const optionsOpen = ref(false)
  const widths = ref<Record<DrawingTool, number>>({
    brush: STROKE_WIDTH_RANGES.brush.initial,
    pencil: STROKE_WIDTH_RANGES.pencil.initial
  })
  const opacities = ref<Record<DrawingTool, number>>({
    brush: STROKE_OPACITY_RANGE.initial,
    pencil: STROKE_OPACITY_RANGE.initial
  })

  const paintTool = computed<DrawingTool>(() => tool.value === 'eraser' ? lastDrawingTool.value : tool.value)
  const strokeWidth = computed(() => widths.value[paintTool.value])
  const strokeOpacity = computed(() => opacities.value[paintTool.value])

  function selectTool(next: ColoringTool) {
    optionsOpen.value = next === tool.value && next !== 'eraser' && !optionsOpen.value
    tool.value = next
    if (next !== 'eraser') lastDrawingTool.value = next
    paletteOpen.value = false
  }

  function selectColor(hex: string) {
    if (hex !== color.value) {
      recentColors.value = [color.value, ...recentColors.value.filter(item => item !== hex && item !== color.value)]
        .slice(0, RECENT_COLORS_LIMIT)
      color.value = hex
    }
    if (tool.value === 'eraser') tool.value = lastDrawingTool.value
    paletteOpen.value = false
    optionsOpen.value = false
  }

  function setWidth(value: number) {
    const { min, max } = STROKE_WIDTH_RANGES[paintTool.value]
    widths.value[paintTool.value] = clamp(Math.round(value), min, max)
  }

  function setOpacity(value: number) {
    opacities.value[paintTool.value] = clamp(Math.round(value * 100) / 100, STROKE_OPACITY_RANGE.min, STROKE_OPACITY_RANGE.max)
  }

  function togglePalette() {
    paletteOpen.value = !paletteOpen.value
    optionsOpen.value = false
  }

  function closePalette() {
    paletteOpen.value = false
    optionsOpen.value = false
  }

  return {
    tool,
    color,
    recentColors,
    paletteOpen,
    optionsOpen,
    widths,
    opacities,
    paintTool,
    strokeWidth,
    strokeOpacity,
    selectTool,
    selectColor,
    setWidth,
    setOpacity,
    togglePalette,
    closePalette
  }
})
