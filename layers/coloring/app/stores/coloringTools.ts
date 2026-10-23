import { DEFAULT_WIDTH_INDEX, STROKE_OPACITIES, STROKE_WIDTHS, type PaintTool, type StrokeTool } from '#layers/coloring/shared/history'

export type ColoringTool = StrokeTool
export type DrawingTool = PaintTool

export const COLORING_TOOLS: readonly ColoringTool[] = ['brush', 'pencil', 'eraser']

export const COLORING_TOOL_LABELS: Record<ColoringTool, string> = {
  brush: 'Кисть',
  pencil: 'Карандаш',
  eraser: 'Ластик'
}

const RECENT_COLORS_LIMIT = 2

export const useColoringToolsStore = defineStore('coloring-tools', () => {
  const tool = ref<ColoringTool>('brush')
  const lastDrawingTool = ref<DrawingTool>('brush')
  const color = ref('#1C41E8')
  const recentColors = ref<string[]>(['#12ABEC', '#EC12AB'])
  const paletteOpen = ref(false)
  const optionsOpen = ref(false)
  const widths = ref<Record<DrawingTool, number>>({ brush: DEFAULT_WIDTH_INDEX, pencil: DEFAULT_WIDTH_INDEX })
  const opacities = ref<Record<DrawingTool, number>>({ brush: 0, pencil: 0 })

  const paintTool = computed<DrawingTool>(() => tool.value === 'eraser' ? lastDrawingTool.value : tool.value)
  const strokeWidth = computed(() => STROKE_WIDTHS[paintTool.value][widths.value[paintTool.value]]!)
  const strokeOpacity = computed(() => STROKE_OPACITIES[opacities.value[paintTool.value]]!)

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

  function selectWidth(index: number) {
    widths.value[paintTool.value] = index
  }

  function selectOpacity(index: number) {
    opacities.value[paintTool.value] = index
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
    selectWidth,
    selectOpacity,
    togglePalette,
    closePalette
  }
})
