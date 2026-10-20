<script setup lang="ts">
// Заполнение рамки по прогрессу: старт с 180° (середина левой стороны), против часовой.
// Кладётся внутрь элемента с CSS-рамкой и рисуется поверх неё; сама рамка — «дорожка»
const props = withDefaults(defineProps<{
  progress: number
  radius?: number
  thickness?: number
}>(), {
  radius: 64,
  thickness: 16
})

const root = ref<HTMLElement | null>(null)
const size = ref<{ width: number, height: number } | null>(null)
// Первое появление — с анимацией от нуля
const ready = ref(false)

let observer: ResizeObserver | undefined

onMounted(() => {
  if (!root.value) return
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    size.value = { width: entry.contentRect.width, height: entry.contentRect.height }
    if (!ready.value) requestAnimationFrame(() => requestAnimationFrame(() => { ready.value = true }))
  })
  observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())

const value = computed(() => Math.min(100, Math.max(0, props.progress)))

const geometry = computed(() => {
  if (!size.value) return null
  const half = props.thickness / 2
  const left = half
  const top = half
  const right = size.value.width - half
  const bottom = size.value.height - half
  const w = right - left
  const h = bottom - top
  if (w <= 0 || h <= 0) return null
  const r = Math.max(0, Math.min(props.radius - half, w / 2, h / 2))
  const middle = top + h / 2

  const d = [
    `M ${left} ${middle}`,
    `V ${bottom - r}`,
    `A ${r} ${r} 0 0 0 ${left + r} ${bottom}`,
    `H ${right - r}`,
    `A ${r} ${r} 0 0 0 ${right} ${bottom - r}`,
    `V ${top + r}`,
    `A ${r} ${r} 0 0 0 ${right - r} ${top}`,
    `H ${left + r}`,
    `A ${r} ${r} 0 0 0 ${left} ${top + r}`,
    'Z'
  ].join(' ')
  const length = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r

  return { d, length }
})

const offset = computed(() => {
  if (!geometry.value) return 0
  const shown = ready.value ? value.value : 0
  return geometry.value.length * (1 - shown / 100)
})
</script>

<template>
  <div ref="root" class="progress-frame" aria-hidden="true">
    <svg v-if="geometry" class="progress-frame__svg" :width="size?.width" :height="size?.height">
      <path
        class="progress-frame__bar"
        :class="{ 'progress-frame__bar--empty': value === 0 }"
        :d="geometry.d"
        :stroke-width="thickness"
        :stroke-dasharray="`${geometry.length} ${geometry.length}`"
        :style="{ strokeDashoffset: offset }"
      />
    </svg>
  </div>
</template>

<style scoped lang="scss">
.progress-frame {
  position: absolute;
  inset: -$frame-border;
  pointer-events: none;
}

.progress-frame__svg {
  display: block;
  overflow: visible;
}

.progress-frame__bar {
  fill: none;
  stroke: $color-progress;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s;
}

// При нуле круглый наконечник рисовал бы точку
.progress-frame__bar--empty {
  opacity: 0;
}
</style>
