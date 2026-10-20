<script setup lang="ts">
const props = defineProps<{
  page: number
  pageCount: number
}>()

// Не больше 7 позиций: 1 … 4 5 6 … 12
const items = computed<(number | 'gap')[]>(() => {
  const { page, pageCount } = props
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const start = Math.min(Math.max(page - 1, 2), pageCount - 4)
  const end = Math.max(Math.min(page + 1, pageCount - 1), 5)
  const middle = Array.from({ length: end - start + 1 }, (_, index) => start + index)
  return [
    1,
    ...(start > 2 ? ['gap' as const] : []),
    ...middle,
    ...(end < pageCount - 1 ? ['gap' as const] : []),
    pageCount
  ]
})

// Первая страница — без ?page в адресе
function pageLink(value: number) {
  return { query: { page: value === 1 ? undefined : String(value) } }
}
</script>

<template>
  <nav class="pagination" aria-label="Страницы галереи">
    <NuxtLink
      v-if="page > 1"
      class="pagination__item pagination__item--arrow"
      :to="pageLink(page - 1)"
      aria-label="Предыдущая страница"
    >
      <svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true">
        <path d="M11 3L3 11l8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </NuxtLink>
    <span v-else class="pagination__item pagination__item--arrow pagination__item--disabled" aria-hidden="true">
      <svg width="14" height="22" viewBox="0 0 14 22">
        <path d="M11 3L3 11l8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>

    <template v-for="(item, index) in items" :key="item === 'gap' ? `gap-${index}` : item">
      <span v-if="item === 'gap'" class="pagination__gap" aria-hidden="true">…</span>
      <NuxtLink
        v-else
        class="pagination__item"
        :class="{ 'pagination__item--current': item === page }"
        :to="pageLink(item)"
        :aria-current="item === page ? 'page' : undefined"
        :aria-label="`Страница ${item}`"
      >
        {{ item }}
      </NuxtLink>
    </template>

    <NuxtLink
      v-if="page < pageCount"
      class="pagination__item pagination__item--arrow"
      :to="pageLink(page + 1)"
      aria-label="Следующая страница"
    >
      <svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true">
        <path d="M3 3l8 8-8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </NuxtLink>
    <span v-else class="pagination__item pagination__item--arrow pagination__item--disabled" aria-hidden="true">
      <svg width="14" height="22" viewBox="0 0 14 22">
        <path d="M3 3l8 8-8 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </nav>
</template>

<style scoped lang="scss">
.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.pagination__item {
  display: grid;
  place-items: center;
  min-width: 56px;
  height: 56px;
  padding: 0 8px;
  border: 6px solid $color-frame;
  border-radius: 20px;
  background: #fff;
  color: $color-ink;
  font-size: 22px;
  font-weight: 700;
  text-decoration: none;
  transition: transform 0.1s;

  &:active {
    transform: scale(0.92);
  }
}

.pagination__item--current {
  border-color: #fff;
  background: $color-accent;
  color: #fff;
  pointer-events: none;
}

.pagination__item--arrow {
  color: $color-sky;
}

.pagination__item--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.pagination__gap {
  min-width: 24px;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
}
</style>
