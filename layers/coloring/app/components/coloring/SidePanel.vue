<script setup lang="ts">
import { COLORING_TOOLS, COLORING_TOOL_LABELS, type ColoringTool, type DrawingTool } from '../../stores/coloringTools'

const store = useColoringToolsStore()
const { tool, color, recentColors, paletteOpen } = storeToRefs(store)

// Панель — колонка справа (горизонтальный экран, как в макете) или полоса снизу
// (телефон вертикально): раскладку переключает CSS, скрипт лишь подгоняет размер предметов.
// Размеры из макета: предмет 44px, зазор 2px; между блоками инструментов и цветов — не меньше 12px
const ITEM_SIZE = 44
const ITEM_GAP = 2
const BLOCK_GAP = 12
// Мельче предметы трудно попадать пальцем — дальше убираем недавние цвета
const MIN_SCALE = 0.72

const root = ref<HTMLElement | null>(null)
// Если не хватает длины панели (низкий экран, узкий телефон) — предметы уменьшаются
// пропорционально, а если не хватает и этого — показывается меньше недавних цветов
const fit = ref({ scale: 1, recent: Number.POSITIVE_INFINITY })

function fitToLength(length: number) {
  const maxRecent = recentColors.value.length
  for (let recent = maxRecent; recent >= 0; recent--) {
    const items = COLORING_TOOLS.length + 1 + recent
    const gaps = (COLORING_TOOLS.length - 1 + recent) * ITEM_GAP + BLOCK_GAP
    const scale = Math.min(1, (length - gaps) / (items * ITEM_SIZE))
    if (scale >= MIN_SCALE || recent === 0) {
      fit.value = { scale: Math.max(scale, 0.5), recent }
      return
    }
  }
}

let observer: ResizeObserver | undefined
// Длина панели вдоль ряда предметов: у колонки — высота, у полосы — ширина
let panelLength = 0
onMounted(() => {
  if (!root.value) return
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    const { width, height } = entry.contentRect
    panelLength = Math.max(width, height)
    fitToLength(panelLength)
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

watch(() => recentColors.value.length, () => {
  if (panelLength) fitToLength(panelLength)
})

// Активный инструмент — первым (сверху или слева), остальные за ним
const tools = computed<ColoringTool[]>(() => [tool.value, ...COLORING_TOOLS.filter(item => item !== tool.value)])

// Цвета показываются тем предметом, которым рисуют: кисточками или карандашами
const colorKind = computed<DrawingTool>(() => tool.value === 'brush' ? 'brush' : 'pencil')

// Порядок в DOM — от конца панели (список *-reverse): активный, недавние, затем вся палитра.
// В открытой палитре места хватает — недавние показываем все. У резинки цвета нет — список пуст
const colors = computed(() => {
  if (tool.value === 'eraser') return []
  const recent = paletteOpen.value ? recentColors.value : recentColors.value.slice(0, fit.value.recent)
  const pinned = [color.value, ...recent]
  if (!paletteOpen.value) return pinned
  return [...pinned, ...PALETTE.map(item => item.hex).filter(hex => !pinned.includes(hex))]
})

const colorList = ref<{ $el: HTMLElement } | null>(null)

// Закрытый список не прокручивается — возвращаем его к активному цвету
watch(paletteOpen, (open) => {
  if (!open && colorList.value) {
    // У *-reverse списка начало прокрутки — у активного цвета
    colorList.value.$el.scrollTop = 0
    colorList.value.$el.scrollLeft = 0
  }
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
          <!-- Активные кисть и карандаш окрашены в выбранный цвет, остальные — как в макете -->
          <span class="side-panel__sprite">
            <ColoringSprite
              :kind="item"
              :color="item === tool && item !== 'eraser' ? color : undefined"
              :flip="item !== 'brush'"
            />
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
          <!-- Смена инструмента: предмет уезжает за край и возвращается кисточкой или карандашом -->
          <span class="side-panel__sprite">
            <Transition name="swap" mode="out-in">
              <ColoringSprite :key="colorKind" :kind="colorKind" :color="hex" />
            </Transition>
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
  // --scale задаёт скрипт по длине панели: 1 — размеры макета
  --scale: 1;
  // Неактивный предмет выглядывает на 60px из 90 — сдвигаем рисунок на 30px к краю экрана
  --shift: calc(30px * var(--scale));
  // Куда уезжают скрытые предметы: колонка — вправо за край, полоса — вниз
  --hidden: translateX(100%);

  position: relative;
  height: 100%;
  overflow: hidden;

  @include phone-portrait {
    --hidden: translateY(100%);
  }
}

.side-panel__tools {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: $item-gap;
  transition: transform 0.2s $ease-out, opacity 0.2s;

  // По ширине содержимого: иначе блок на всю полосу перехватывал бы нажатия по цветам
  @include phone-portrait {
    flex-direction: row;
    width: fit-content;
    height: 100%;
  }
}

.side-panel__tools--hidden {
  transform: var(--hidden);
  opacity: 0;
  pointer-events: none;
}

// Цвета прижаты к концу панели (низ колонки, правый край полосы);
// при открытой палитре список растёт к началу и прокручивается
.side-panel__colors {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column-reverse;
  gap: $item-gap;
  overflow: hidden;
  pointer-events: none;

  @include phone-portrait {
    flex-direction: row-reverse;
  }
}

.side-panel__colors--open {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  pointer-events: auto;

  &::-webkit-scrollbar {
    display: none;
  }

  @include phone-portrait {
    overflow-x: auto;
    overflow-y: hidden;
  }
}

.side-panel__item {
  flex: none;
  height: calc(44px * var(--scale));
  pointer-events: auto;

  @include phone-portrait {
    width: calc(44px * var(--scale));
    height: auto;
  }
}

.side-panel__button {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

// Рисунок 160×44 (остриём влево) масштабируется вместе с предметом.
// В полосе он повёрнут на 90° — остриём вверх; --offset — насколько он задвинут за край
.side-panel__sprite {
  --offset: var(--shift);
  --x: var(--offset);
  --y: 0px;
  --rotate: 0deg;

  // От угла кнопки: кнопка центрирует содержимое, и в полосе (90px) рисунок съезжал вниз
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: 160px;
  height: 44px;
  transform-origin: 0 0;
  transform: translate(var(--x), var(--y)) rotate(var(--rotate)) scale(var(--scale));
  transition: transform 0.2s $ease-out;

  @include phone-portrait {
    --x: calc(44px * var(--scale));
    --y: var(--offset);
    --rotate: 90deg;
  }
}

.side-panel__button--active .side-panel__sprite {
  --offset: 0px;
}

@media (hover: hover) {
  .side-panel__button:not(.side-panel__button--active):hover .side-panel__sprite {
    --offset: calc(var(--shift) - 10px);
  }
}

// Перестановка инструментов и цветов
.tool-move,
.color-move {
  transition: transform 0.25s $ease-out;
}

// Карандаши палитры выезжают по очереди от активного; задержка ограничена,
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
  transform: var(--hidden);
}

// Карандаши ↔ кисточки — волной от активного цвета. Сдвиг вдоль самого рисунка:
// он внутри повёрнутого контейнера, поэтому и в колонке, и в полосе уходит за край экрана
.swap-enter-active,
.swap-leave-active {
  transition-delay: calc(min(var(--index), 8) * 25ms);
}

.swap-enter-active {
  transition-property: transform;
  transition-duration: 0.18s;
  transition-timing-function: $ease-out;
}

.swap-leave-active {
  transition-property: transform;
  transition-duration: 0.12s;
  transition-timing-function: ease-in;
}

.swap-enter-from,
.swap-leave-to {
  transform: translateX(100%);
}
</style>
