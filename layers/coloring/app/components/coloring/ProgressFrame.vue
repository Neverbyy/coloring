<script setup lang="ts">
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
@property --progress {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

.progress-frame {
  position: absolute;
  inset: calc(-1 * var(--thickness));
  container-type: size;
  pointer-events: none;
  transition: --progress 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

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
  --w: calc(100cqw - var(--thickness));
  --h: calc(100cqh - var(--thickness));
  --r: min(calc(var(--outer-radius) - var(--thickness) / 2), calc(var(--w) / 2), calc(var(--h) / 2));
  --perimeter: calc(2 * var(--w) + 2 * var(--h) - 8 * var(--r) + 6.2832 * var(--r));
  --start: calc(var(--w) - 2 * var(--r) + 1.5708 * var(--r) + (var(--h) - 2 * var(--r)) / 2);
  --length: calc(var(--progress) * var(--perimeter));
  --main: min(var(--length), calc(var(--perimeter) - var(--start)));
  --wrap: max(0px, calc(var(--length) - var(--perimeter) + var(--start)));

  fill: none;
  stroke: $color-progress;
  stroke-width: var(--thickness);
  stroke-linecap: butt;
  stroke-dasharray: var(--wrap) calc(var(--start) - var(--wrap)) var(--main) var(--perimeter);
  rx: var(--r);
  ry: var(--r);
  transition: stroke 0.3s;
}

.progress-frame--done .progress-frame__bar {
  stroke: $color-accent;
}
</style>
