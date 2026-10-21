import type { StrokeTool } from '../../shared/history'

// Инструменты панели — те же, что в операциях истории
export type ColoringTool = StrokeTool
// Чем рисуют цветом (у резинки цвета нет)
export type DrawingTool = Exclude<ColoringTool, 'eraser'>

export const COLORING_TOOLS: readonly ColoringTool[] = ['brush', 'pencil', 'eraser']

export const COLORING_TOOL_LABELS: Record<ColoringTool, string> = {
  brush: 'Кисть',
  pencil: 'Карандаш',
  eraser: 'Ластик'
}

// Сколько недавних цветов видно под активным, когда палитра закрыта
const RECENT_COLORS_LIMIT = 2

export const useColoringToolsStore = defineStore('coloring-tools', () => {
  // Начальное состояние — как в макете: кисть, синий; выше — голубой и розовый
  const tool = ref<ColoringTool>('brush')
  const lastDrawingTool = ref<DrawingTool>('brush')
  const color = ref('#1C41E8')
  const recentColors = ref<string[]>(['#12ABEC', '#EC12AB'])
  const paletteOpen = ref(false)

  function selectTool(next: ColoringTool) {
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
    // Выбор цвета означает, что ребёнок хочет рисовать, — снимаем резинку
    if (tool.value === 'eraser') tool.value = lastDrawingTool.value
    paletteOpen.value = false
  }

  function togglePalette() {
    paletteOpen.value = !paletteOpen.value
  }

  function closePalette() {
    paletteOpen.value = false
  }

  return { tool, color, recentColors, paletteOpen, selectTool, selectColor, togglePalette, closePalette }
})
