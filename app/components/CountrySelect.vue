<script setup lang="ts">
import type { CountryOption } from '~/composables/useCountryOptions'

// Свой список вместо <select>: в нативном нельзя показать флаги-картинки
// (эмодзи-флагов нет в Windows) и ограничить высоту выпадающего меню
const props = defineProps<{
  options: CountryOption[]
  placeholder?: string
}>()

const model = defineModel<string>({ required: true })

const MARGIN = 8
const GAP = 6
const MAX_HEIGHT = 320
const MIN_WIDTH = 280
// Если снизу меньше — меню открывается вверх (когда сверху просторнее)
// или на всю высоту экрана (когда тесно с обеих сторон)
const MIN_SPACE = 220

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
  if (!q) return props.options
  return props.options.filter(option =>
    option.name.toLocaleLowerCase('ru').includes(q) || option.code.toLowerCase() === q
  )
})

watch(filtered, () => {
  activeIndex.value = filtered.value.length ? 0 : -1
})

function flagUrl(code: string) {
  return `/flags/${code.toLowerCase()}.svg`
}

function optionId(index: number) {
  return `${id}-option-${index}`
}

function place() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const viewportWidth = window.innerWidth
  const below = viewportHeight - rect.bottom - MARGIN - GAP
  const above = rect.top - MARGIN - GAP
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), viewportWidth - 2 * MARGIN)
  const left = Math.min(Math.max(rect.left, MARGIN), viewportWidth - width - MARGIN)
  const horizontal = { left: `${left}px`, width: `${width}px` }

  // Низкий экран (телефон горизонтально): мало места и сверху, и снизу —
  // показываем меню на всю высоту поверх формы
  if (Math.max(below, above) < MIN_SPACE) {
    const height = Math.min(MAX_HEIGHT, viewportHeight - 2 * MARGIN)
    placement.value = {
      up: false,
      style: { ...horizontal, top: `${(viewportHeight - height) / 2}px`, maxHeight: `${height}px` }
    }
    return
  }

  const up = below < MIN_SPACE && above > below
  placement.value = {
    up,
    style: {
      ...horizontal,
      maxHeight: `${Math.min(MAX_HEIGHT, up ? above : below)}px`,
      ...(up
        ? { bottom: `${viewportHeight - rect.top + GAP}px` }
        : { top: `${rect.bottom + GAP}px` })
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
  // Выбранная страна — в середине списка, а не у края
  const element = list.value?.querySelector<HTMLElement>(`#${CSS.escape(optionId(activeIndex.value))}`)
  if (element && list.value) list.value.scrollTop = element.offsetTop - list.value.clientHeight / 2 + element.offsetHeight / 2
  // На тач-устройствах не открываем клавиатуру сразу — она закроет пол-экрана
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

function onPointerDownOutside(event: PointerEvent) {
  const target = event.target as Node
  if (panel.value?.contains(target) || trigger.value?.contains(target)) return
  hide()
}

function onViewportChange() {
  if (open.value) place()
}

function listen(enabled: boolean) {
  const method = enabled ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onPointerDownOutside as EventListener)
  window[method]('resize', onViewportChange)
  window.visualViewport?.[method]('resize', onViewportChange)
}

watch(open, listen)

onBeforeUnmount(() => listen(false))
</script>

<template>
  <div class="country-select">
    <button
      ref="trigger"
      type="button"
      class="country-select__trigger"
      :class="{ 'country-select__trigger--open': open }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      aria-label="Страна"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <template v-if="selected">
        <img class="country-select__flag" :src="flagUrl(selected.code)" alt="" width="24" height="18">
        <span class="country-select__label">{{ selected.name }}</span>
      </template>
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
          :class="{ 'country-select__panel--up': placement.up }"
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
              <img class="country-select__flag" :src="flagUrl(option.code)" alt="" width="24" height="18" loading="lazy">
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
  transform-origin: bottom center;
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
  // Не меньше 16px — иначе iOS зумит страницу при фокусе
  font: 500 18px/1 $font-body;

  &::placeholder {
    color: $color-placeholder;
  }
}

.country-select__list {
  // offsetParent для пунктов — нужен, чтобы прокрутить к выбранной стране
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
