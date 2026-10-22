<script setup lang="ts">
import type { CountryOption } from '~/composables/useCountryOptions'

const props = withDefaults(defineProps<{
  options: CountryOption[]
  placeholder?: string
  label?: string
  compact?: boolean
  clearLabel?: string
}>(), {
  placeholder: undefined,
  label: 'Страна',
  clearLabel: undefined
})

const model = defineModel<string>({ required: true })

const MARGIN = 8
const GAP = 6
const MAX_HEIGHT = 320
const MIN_WIDTH = 280
const MIN_SPACE = 220
const TAP_SLOP = 10

const id = useId()
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const search = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const open = ref(false)
const query = ref('')
const activeIndex = ref(-1)
const placement = ref<{ style: Record<string, string>, up: boolean }>({ style: {}, up: false })

const selected = computed(() => props.options.find(option => option.code === model.value))

const filtered = computed(() => {
  const q = query.value.trim().toLocaleLowerCase('ru')
  if (!q) return props.clearLabel ? [{ code: '', name: props.clearLabel }, ...props.options] : props.options
  const starting: CountryOption[] = []
  const containing: CountryOption[] = []
  for (const option of props.options) {
    const name = option.name.toLocaleLowerCase('ru')
    if (name.startsWith(q) || option.code.toLowerCase() === q) starting.push(option)
    else if (name.includes(q)) containing.push(option)
  }
  return [...starting, ...containing]
})

watch(filtered, () => {
  activeIndex.value = filtered.value.length ? 0 : -1
  if (list.value) list.value.scrollTop = 0
})

function optionId(index: number) {
  return `${id}-option-${index}`
}

function place() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const visibleTop = window.visualViewport?.offsetTop ?? 0
  const visibleBottom = visibleTop + (window.visualViewport?.height ?? window.innerHeight)
  const viewportWidth = window.innerWidth
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), viewportWidth - 2 * MARGIN)
  const left = Math.min(Math.max(rect.left, MARGIN), viewportWidth - width - MARGIN)
  const horizontal = { left: `${left}px`, width: `${width}px` }
  const downTop = Math.max(rect.bottom + GAP, visibleTop + MARGIN)
  const upBottom = Math.min(rect.top - GAP, visibleBottom - MARGIN)
  const below = visibleBottom - MARGIN - downTop
  const above = upBottom - visibleTop - MARGIN

  if (Math.max(below, above) < MIN_SPACE) {
    const height = Math.min(MAX_HEIGHT, visibleBottom - visibleTop - 2 * MARGIN)
    placement.value = {
      up: false,
      style: { ...horizontal, top: `${(visibleTop + visibleBottom - height) / 2}px`, maxHeight: `${height}px` }
    }
    return
  }

  const up = below < MIN_SPACE && above > below
  placement.value = {
    up,
    style: {
      ...horizontal,
      top: `${up ? upBottom : downTop}px`,
      maxHeight: `${Math.min(MAX_HEIGHT, up ? above : below)}px`,
      ...(up ? { translate: '0 -100%' } : {})
    }
  }
}

function scrollToActive() {
  const element = list.value?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex.value))}`)
  element?.scrollIntoView({ block: 'nearest' })
}

async function show() {
  query.value = ''
  place()
  open.value = true
  await nextTick()
  activeIndex.value = Math.max(0, filtered.value.findIndex(option => option.code === model.value))
  const element = list.value?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex.value))}`)
  if (element && list.value) list.value.scrollTop = element.offsetTop - list.value.clientHeight / 2 + element.offsetHeight / 2
  if (!isTouchDevice()) search.value?.focus()
}

function hide(focusTrigger = false) {
  open.value = false
  if (focusTrigger) trigger.value?.focus()
}

function toggle() {
  if (open.value) hide()
  else show()
}

function choose(option: CountryOption) {
  model.value = option.code
  hide(true)
}

function onKeydown(event: KeyboardEvent) {
  const count = filtered.value.length
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!count) return
    const step = event.key === 'ArrowDown' ? 1 : -1
    activeIndex.value = (activeIndex.value + step + count) % count
    nextTick(scrollToActive)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const option = filtered.value[activeIndex.value]
    if (option) choose(option)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    hide(true)
  } else if (event.key === 'Tab') {
    hide()
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    show()
  }
}

function isInside(target: EventTarget | null) {
  const node = target as Node
  return Boolean(panel.value?.contains(node) || trigger.value?.contains(node))
}

let outsidePress: { x: number, y: number } | null = null

function onPointerDown(event: PointerEvent) {
  outsidePress = null
  if (isInside(event.target)) return
  if (event.pointerType === 'mouse') hide()
  else outsidePress = { x: event.clientX, y: event.clientY }
}

function onPointerUp(event: PointerEvent) {
  if (!outsidePress) return
  const moved = Math.hypot(event.clientX - outsidePress.x, event.clientY - outsidePress.y)
  outsidePress = null
  if (moved < TAP_SLOP && !isInside(event.target)) hide()
}

function onViewportChange() {
  if (open.value) place()
}

function onScroll(event: Event) {
  if (!panel.value?.contains(event.target as Node)) onViewportChange()
}

function listen(enabled: boolean) {
  const method = enabled ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onPointerDown as EventListener)
  document[method]('pointerup', onPointerUp as EventListener)
  document[method]('scroll', onScroll, true)
  window[method]('resize', onViewportChange)
  window.visualViewport?.[method]('resize', onViewportChange)
  window.visualViewport?.[method]('scroll', onViewportChange)
}

watch(open, listen)

onBeforeUnmount(() => listen(false))
</script>

<template>
  <div class="country-select" :class="{ 'country-select--compact': compact }">
    <button
      ref="trigger"
      type="button"
      class="country-select__trigger"
      :class="{ 'country-select__trigger--open': open }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      :aria-label="label"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <template v-if="selected">
        <img class="country-select__flag" :src="flagUrl(selected.code)" alt="" width="24" height="18">
        <span class="country-select__label">{{ selected.name }}</span>
      </template>
      <span v-else-if="clearLabel && !model" class="country-select__label">{{ clearLabel }}</span>
      <span v-else class="country-select__label country-select__label--placeholder">{{ placeholder }}</span>
      <svg class="country-select__chevron" width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
        <path d="M2 2l6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="country-select-panel">
        <div
          v-if="open"
          ref="panel"
          class="country-select__panel"
          :class="{ 'country-select__panel--up': placement.up, 'country-select__panel--compact': compact }"
          :style="placement.style"
        >
          <input
            ref="search"
            v-model="query"
            class="country-select__search"
            type="text"
            placeholder="Поиск"
            role="combobox"
            aria-label="Поиск страны"
            aria-autocomplete="list"
            :aria-expanded="open"
            :aria-controls="`${id}-list`"
            :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            @keydown="onKeydown"
          >
          <ul :id="`${id}-list`" ref="list" class="country-select__list" role="listbox" aria-label="Страны">
            <li
              v-for="(option, index) in filtered"
              :id="optionId(index)"
              :key="option.code"
              class="country-select__option"
              :class="{
                'country-select__option--active': index === activeIndex,
                'country-select__option--selected': option.code === model
              }"
              role="option"
              :aria-selected="option.code === model"
              @pointermove="activeIndex = index"
              @click="choose(option)"
            >
              <img v-if="option.code" class="country-select__flag" :src="flagUrl(option.code)" alt="" width="24" height="18" loading="lazy">
              <span class="country-select__label">{{ option.name }}</span>
            </li>
            <li v-if="!filtered.length" class="country-select__empty">Ничего не нашлось</li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.country-select {
  min-width: 0;
}

.country-select__trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  @include text-field;
  text-align: left;

  &:focus-visible,
  &--open {
    border-color: $color-sky;
    outline: none;
  }
}

.country-select__chevron {
  flex: none;
  margin-left: auto;
  color: $color-sky;
  transition: transform 0.15s;
}

.country-select__trigger--open .country-select__chevron {
  transform: rotate(180deg);
}

.country-select__flag {
  flex: none;
  width: 24px;
  height: 18px;
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba($color-ink, 0.12);
  object-fit: cover;
}

.country-select__label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.country-select__label--placeholder {
  color: $color-placeholder;
}

.country-select__panel {
  position: fixed;
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 4px solid $color-frame;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 12px 32px rgba($color-ink, 0.18);
  color: $color-ink;
  transform-origin: top center;
}

.country-select__panel--up {
  flex-direction: column-reverse;
  transform-origin: bottom center;

  .country-select__search {
    margin: 4px 8px 8px;
  }

  .country-select__list {
    padding: 8px 8px 4px;
  }
}

.country-select__search {
  flex: none;
  height: 48px;
  margin: 8px 8px 4px;
  padding: 0 16px;
  border: 0;
  border-radius: 16px;
  outline: none;
  background: $color-board;
  color: $color-ink;
  font: 500 18px/1 $font-body;

  &::placeholder {
    color: $color-placeholder;
  }
}

.country-select__list {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 4px 8px 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.country-select__option {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
}

.country-select__option--active {
  background: $color-frame;
}

.country-select__option--selected {
  font-weight: 700;
}

.country-select__empty {
  padding: 12px;
  color: rgba($color-ink, 0.5);
  font-size: 16px;
  text-align: center;
}

.country-select--compact {
  .country-select__trigger {
    gap: 8px;
    height: 40px;
    padding: 0 12px;
    border-width: 1px;
    border-color: #e2e8f0;
    border-radius: 10px;
    font: inherit;

    &:focus-visible,
    &.country-select__trigger--open {
      border-color: $color-progress;
    }
  }

  .country-select__chevron {
    width: 12px;
    color: rgba($color-ink, 0.5);
  }

  .country-select__flag {
    width: 20px;
    height: 15px;
    border-radius: 2px;
  }
}

.country-select__panel--compact {
  border-width: 1px;
  border-color: #e2e8f0;
  border-radius: 10px;

  .country-select__search {
    height: 36px;
    margin: 6px 6px 2px;
    padding: 0 12px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 16px;
    font-weight: 400;
  }

  .country-select__list {
    padding: 4px 6px 6px;
  }

  .country-select__option {
    gap: 8px;
    min-height: 36px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 400;
  }

  .country-select__option--active {
    background: #e3f2fc;
  }

  .country-select__flag {
    width: 20px;
    height: 15px;
    border-radius: 2px;
  }

  &.country-select__panel--up {
    .country-select__search {
      margin: 2px 6px 6px;
    }

    .country-select__list {
      padding: 6px 6px 4px;
    }
  }
}

.country-select-panel-enter-active,
.country-select-panel-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}

.country-select-panel-enter-from,
.country-select-panel-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
