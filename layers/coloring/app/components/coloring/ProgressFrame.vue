<script setup lang="ts">
// Заполнение рамки по прогрессу: старт с 180° (середина левой стороны), против часовой.
// Кладётся внутрь элемента с CSS-рамкой и рисуется поверх неё; сама рамка — «дорожка».
// Геометрия считается в CSS от размеров контейнера (единицы cq) — без скриптов и замеров,
// поэтому прогресс виден сразу, ещё с сервера
const props = withDefaults(defineProps<{
  progress: number
  radius?: number
  thickness?: number
}>(), {
  radius: 64,
  thickness: 16
})

const value = computed(() => Math.min(100, Math.max(0, props.progress)) / 100)

const style = computed(() => ({
  '--progress': value.value,
  '--thickness': `${props.thickness}px`,
  '--outer-radius': `${props.radius}px`
}))

// Запасной путь для браузеров без calc()/min() в stroke-dasharray или rx в CSS:
// те же формулы считаются скриптом по замеренному размеру
const root = ref<HTMLElement | null>(null)
const measured = ref<{ width: number, height: number } | null>(null)
let observer: ResizeObserver | undefined

onMounted(() => {
  const supported = CSS.supports('stroke-dasharray', 'max(0px, calc(1cqw - 1px)) min(1px, 2px)') && CSS.supports('rx', '1px')
  if (supported || !root.value) return
  observer = new ResizeObserver(([entry]) => {
    if (entry) measured.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  })
  observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())

const fallback = computed(() => {
  if (!measured.value) return undefined
  const t = props.thickness
  const w = measured.value.width - t
  const h = measured.value.height - t
  const r = Math.max(0, Math.min(props.radius - t / 2, w / 2, h / 2))
  const perimeter = 2 * w + 2 * h - 8 * r + 2 * Math.PI * r
  const start = w - 2 * r + (Math.PI / 2) * r + (h - 2 * r) / 2
  const length = value.value * perimeter
  const main = Math.min(length, perimeter - start)
  const wrap = Math.max(0, length - perimeter + start)
  return { strokeDasharray: `${wrap} ${start - wrap} ${main} ${perimeter}`, rx: `${r}px`, ry: `${r}px` }
})
</script>

<template>
  <div ref="root" class="progress-frame" :class="{ 'progress-frame--done': value >= 1 }" :style="style" aria-hidden="true">
    <svg class="progress-frame__svg">
      <!-- rx-атрибут — на случай, если браузер не понимает rx в CSS -->
      <rect
        class="progress-frame__bar"
        width="100%"
        height="100%"
        :rx="radius - thickness / 2"
        :ry="radius - thickness / 2"
        :style="fallback"
      />
    </svg>
  </div>
</template>

<style scoped lang="scss">
.progress-frame {
  position: absolute;
  inset: calc(-1 * var(--thickness));
  container-type: size;
  pointer-events: none;
}

// Линия проходит по середине рамки: svg на половину толщины внутри.
// Прямоугольник SVG обходится по часовой от верхнего левого угла; отражение по горизонтали
// даёт обход против часовой от верхнего правого — как требуется
.progress-frame__svg {
  position: absolute;
  inset: calc(var(--thickness) / 2);
  display: block;
  width: calc(100% - var(--thickness));
  height: calc(100% - var(--thickness));
  overflow: visible;
  transform: scaleX(-1);
}

.progress-frame__bar {
  // Размеры линии: стороны, радиус скругления, периметр
  --w: calc(100cqw - var(--thickness));
  --h: calc(100cqh - var(--thickness));
  --r: min(calc(var(--outer-radius) - var(--thickness) / 2), calc(var(--w) / 2), calc(var(--h) / 2));
  --perimeter: calc(2 * var(--w) + 2 * var(--h) - 8 * var(--r) + 6.2832 * var(--r));
  // От старта (верхний правый угол) до середины левой стороны: верх + четверть дуги + пол-левой стороны
  --start: calc(var(--w) - 2 * var(--r) + 1.5708 * var(--r) + (var(--h) - 2 * var(--r)) / 2);
  --length: calc(var(--progress) * var(--perimeter));
  // Отрезок от середины левой стороны до конца контура и «перешагнувший» старт остаток
  --main: min(var(--length), calc(var(--perimeter) - var(--start)));
  --wrap: max(0px, calc(var(--length) - var(--perimeter) + var(--start)));

  fill: none;
  stroke: $color-progress;
  stroke-width: var(--thickness);
  // Плоские концы: у нулевых отрезков пунктира круглые концы рисуют точки
  stroke-linecap: butt;
  stroke-dasharray: var(--wrap) calc(var(--start) - var(--wrap)) var(--main) var(--perimeter);
  rx: var(--r);
  ry: var(--r);
  transition: stroke-dasharray 0.6s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s;
}

// На 100% — оранжевая, как цифра «100%»: голубая сливается с небом и синей краской
.progress-frame--done .progress-frame__bar {
  stroke: $color-accent;
}
</style>
