<script setup lang="ts">
import { COLORING_TOOLS, COLORING_TOOL_LABELS, type ColoringTool } from '../../stores/coloringTools'

const store = useColoringToolsStore()
const { tool, color, recentColors, paletteOpen } = storeToRefs(store)

// Размеры из макета: предмет 44px, зазор 2px; между блоками инструментов и цветов — не меньше 12px
const ITEM_HEIGHT = 44
const ITEM_GAP = 2
const BLOCK_GAP = 12
// Мельче предметы трудно попадать пальцем — дальше убираем недавние цвета
const MIN_SCALE = 0.72

const root = ref<HTMLElement | null>(null)
// На низком экране (телефон с панелью браузера) предметы уменьшаются пропорционально,
// а если не хватает и этого — показывается меньше недавних цветов
const fit = ref({ scale: 1, recent: Number.POSITIVE_INFINITY })

function fitToHeight(height: number) {
  const maxRecent = recentColors.value.length
  for (let recent = maxRecent; recent >= 0; recent--) {
    const items = COLORING_TOOLS.length + 1 + recent
    const gaps = (COLORING_TOOLS.length - 1 + recent) * ITEM_GAP + BLOCK_GAP
    const scale = Math.min(1, (height - gaps) / (items * ITEM_HEIGHT))
    if (scale >= MIN_SCALE || recent === 0) {
      fit.value = { scale: Math.max(scale, 0.5), recent }
      return
    }
  }
}

let observer: ResizeObserver | undefined
let panelHeight = 0
onMounted(() => {
  if (!root.value) return
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    panelHeight = entry.contentRect.height
    fitToHeight(panelHeight)
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

watch(() => recentColors.value.length, () => {
  if (panelHeight) fitToHeight(panelHeight)
})

// Активный инструмент — всегда сверху, остальные под ним
const tools = computed<ColoringTool[]>(() => [tool.value, ...COLORING_TOOLS.filter(item => item !== tool.value)])

// Порядок в DOM — снизу вверх (список column-reverse): активный, недавние, затем вся палитра.
// В открытой палитре места хватает — недавние показываем все
const colors = computed(() => {
  const recent = paletteOpen.value ? recentColors.value : recentColors.value.slice(0, fit.value.recent)
  const pinned = [color.value, ...recent]
  if (!paletteOpen.value) return pinned
  return [...pinned, ...PALETTE.map(item => item.hex).filter(hex => !pinned.includes(hex))]
})

const colorList = ref<{ $el: HTMLElement } | null>(null)

// Закрытый список не прокручивается — возвращаем его к активному цвету
watch(paletteOpen, (open) => {
  if (!open && colorList.value) colorList.value.$el.scrollTop = 0
})

function onColorClick(hex: string) {
  if (hex === color.value) store.togglePalette()
  else store.selectColor(hex)
}

function colorLabel(hex: string) {
  const name = paletteColorName(hex)
  if (hex !== color.value) return name
  return paletteOpen.value ? `${name}, закрыть палитру` : `${name}, открыть палитру`
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') store.closePalette()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div ref="root" class="side-panel" :style="{ '--scale': fit.scale }">
    <TransitionGroup
      tag="ul"
      name="tool"
      class="side-panel__tools"
      :class="{ 'side-panel__tools--hidden': paletteOpen }"
      aria-label="Инструменты"
    >
      <li v-for="item in tools" :key="item" class="side-panel__item">
        <button
          type="button"
          class="side-panel__button"
          :class="{ 'side-panel__button--active': item === tool }"
          :aria-label="COLORING_TOOL_LABELS[item]"
          :aria-pressed="item === tool"
          :tabindex="paletteOpen ? -1 : undefined"
          @click="store.selectTool(item)"
        >
          <span class="side-panel__sprite">
            <ColoringSprite :kind="item" :flip="item !== 'brush'" />
          </span>
        </button>
      </li>
    </TransitionGroup>

    <TransitionGroup
      ref="colorList"
      tag="ul"
      name="color"
      class="side-panel__colors"
      :class="{ 'side-panel__colors--open': paletteOpen }"
      aria-label="Цвета"
    >
      <li
        v-for="(hex, index) in colors"
        :key="hex"
        class="side-panel__item"
        :style="{ '--index': index }"
      >
        <button
          type="button"
          class="side-panel__button"
          :class="{ 'side-panel__button--active': hex === color }"
          :aria-label="colorLabel(hex)"
          :aria-pressed="hex === color"
          :aria-expanded="hex === color ? paletteOpen : undefined"
          @click="onColorClick(hex)"
        >
          <span class="side-panel__sprite">
            <ColoringSprite kind="pencil" :color="hex" />
          </span>
        </button>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
$item-gap: 2px;
$ease-out: cubic-bezier(0.22, 1, 0.36, 1);

.side-panel {
  // --scale задаёт скрипт по высоте панели: 1 — размеры макета
  --scale: 1;
  // Неактивный предмет выглядывает на 60px из 90 — сдвигаем рисунок вправо на 30px
  --shift: calc(30px * var(--scale));

  position: relative;
  height: 100%;
  overflow: hidden;
}

.side-panel__tools {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: $item-gap;
  transition: transform 0.2s $ease-out, opacity 0.2s;
}

.side-panel__tools--hidden {
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
}

// Цвета прижаты к низу; при открытой палитре список растёт вверх и прокручивается
.side-panel__colors {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column-reverse;
  gap: $item-gap;
  overflow: hidden;
  pointer-events: none;
}

.side-panel__colors--open {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  pointer-events: auto;

  &::-webkit-scrollbar {
    display: none;
  }
}

.side-panel__item {
  flex: none;
  height: calc(44px * var(--scale));
  pointer-events: auto;
}

.side-panel__button {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

// Рисунок 160×44 масштабируется вместе с предметом
.side-panel__sprite {
  display: block;
  width: 160px;
  height: 44px;
  transform-origin: 0 0;
  transform: translateX(var(--shift)) scale(var(--scale));
  transition: transform 0.2s $ease-out;
}

.side-panel__button--active .side-panel__sprite {
  transform: scale(var(--scale));
}

@media (hover: hover) {
  .side-panel__button:not(.side-panel__button--active):hover .side-panel__sprite {
    transform: translateX(calc(var(--shift) - 10px)) scale(var(--scale));
  }
}

// Перестановка инструментов и цветов
.tool-move,
.color-move {
  transition: transform 0.25s $ease-out;
}

// Карандаши палитры выезжают по очереди снизу вверх; задержка ограничена,
// чтобы невидимые за краем экрана не тормозили открытие
.color-enter-active {
  transition: transform 0.22s $ease-out;
  transition-delay: calc(clamp(0, var(--index) - 3, 10) * 20ms);
}

.color-leave-active {
  transition: transform 0.15s ease-in;
}

.color-enter-from,
.color-leave-to {
  transform: translateX(100%);
}
</style>
