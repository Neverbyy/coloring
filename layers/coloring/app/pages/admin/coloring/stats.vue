<script setup lang="ts">
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import type { ArtStatsRow, ColoringStats, StatsPeriod } from '../../../../shared/admin'

useHead({ title: 'Статистика' })

const PERIODS: { value: StatsPeriod, label: string }[] = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: 'all', label: 'Всё время' }
]
const period = ref<StatsPeriod>('30')
const country = ref('')
const countries = useCountryOptions()

const { data, isPending, error } = useQuery({
  queryKey: computed(() => ['admin', 'coloring', 'stats', period.value, country.value]),
  queryFn: () => adminFetch<ColoringStats>('/api/admin/coloring/stats', {
    query: { period: period.value, country: country.value || undefined }
  }),
  placeholderData: keepPreviousData
})

const completionRate = (row: ArtStatsRow) => row.started > 0 ? row.completed / row.started : -1

type SortKey = 'title' | 'openers' | 'started' | 'completed' | 'rate'
const COLUMNS: { key: SortKey, label: string, hint?: string }[] = [
  { key: 'openers', label: 'Открыли' },
  { key: 'started', label: 'Начали' },
  { key: 'completed', label: 'Завершили' },
  { key: 'rate', label: 'Доводят до конца', hint: 'Доля завершивших среди начавших' }
]
const SORT_OPTIONS: { key: SortKey, label: string }[] = [...COLUMNS, { key: 'title', label: 'Название' }]
const sortKey = ref<SortKey>('openers')
const sortDescending = ref(true)

function sortBy(key: SortKey) {
  if (sortKey.value === key) sortDescending.value = !sortDescending.value
  else {
    sortKey.value = key
    sortDescending.value = key !== 'title'
  }
}

const rows = computed(() => {
  const items = [...(data.value?.items ?? [])]
  const value = (row: ArtStatsRow) => sortKey.value === 'rate' ? completionRate(row) : sortKey.value === 'title' ? 0 : row[sortKey.value]
  items.sort((a, b) => {
    const order = sortKey.value === 'title' ? a.title.localeCompare(b.title, 'ru') : value(a) - value(b)
    return sortDescending.value ? -order : order
  })
  return items
})

const BAR_WIDTH = 80
const maxOpeners = computed(() => Math.max(1, ...(data.value?.items ?? []).map(row => row.openers)))

function ariaSort(key: SortKey) {
  if (sortKey.value !== key) return 'none'
  return sortDescending.value ? 'descending' : 'ascending'
}
</script>

<template>
  <div class="admin-page">
    <header class="admin-page__header">
      <h1 class="admin-title">Статистика</h1>
    </header>

    <div class="admin-toolbar">
      <nav class="admin-tabs" aria-label="Период">
        <button
          v-for="item in PERIODS"
          :key="item.value"
          type="button"
          class="admin-tab"
          :class="{ 'admin-tab--active': period === item.value }"
          :aria-pressed="period === item.value"
          @click="period = item.value"
        >
          {{ item.label }}
        </button>
      </nav>
      <CountrySelect
        v-model="country"
        class="stats__country"
        :options="countries"
        clear-label="Все страны"
        label="Страна игроков"
        compact
      />
    </div>

    <p v-if="error" class="admin-notice admin-notice--danger">{{ errorMessage(error, 'Не удалось загрузить статистику') }}</p>
    <p v-else-if="isPending" class="admin-empty">Загружаем…</p>
    <template v-else-if="data">
      <div class="admin-tiles">
        <div class="admin-tile">
          <div class="admin-tile__value">{{ formatNumber(data.totals.openers) }}</div>
          <div class="admin-tile__label">игроков открывали рисунки</div>
        </div>
        <div class="admin-tile">
          <div class="admin-tile__value">{{ formatNumber(data.totals.started) }}</div>
          <div class="admin-tile__label">рисунков начато</div>
        </div>
        <div class="admin-tile">
          <div class="admin-tile__value">{{ formatNumber(data.totals.completed) }}</div>
          <div class="admin-tile__label">рисунков завершено</div>
        </div>
      </div>

      <label v-if="rows.length" class="admin-field stats__sort-select">
        Сортировать
        <select v-model="sortKey" class="admin-select" @change="sortDescending = sortKey !== 'title'">
          <option v-for="option in SORT_OPTIONS" :key="option.key" :value="option.key">{{ option.label }}</option>
        </select>
      </label>

      <p v-if="!rows.length" class="admin-empty">Опубликованных раскрасок пока нет</p>
      <div v-else class="admin-table-wrap">
        <table class="admin-table stats__table">
          <thead>
            <tr>
              <th :aria-sort="ariaSort('title')">
                <button type="button" class="stats__sort" @click="sortBy('title')">Раскраска</button>
              </th>
              <th v-for="column in COLUMNS" :key="column.key" class="admin-table__number" :aria-sort="ariaSort(column.key)">
                <button type="button" class="stats__sort" :title="column.hint" @click="sortBy(column.key)">
                  {{ column.label }}
                  <span v-if="sortKey === column.key" aria-hidden="true">{{ sortDescending ? '↓' : '↑' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <NuxtLink :to="`/admin/coloring/arts/${row.id}`" class="stats__art">
                  <img :src="row.image" alt="" class="stats__thumb" loading="lazy">
                  <span>
                    {{ row.title }}
                    <span v-if="row.status !== 'published'" class="admin-badge">скрыт</span>
                  </span>
                </NuxtLink>
              </td>
              <td class="admin-table__number" data-label="Открыли">
                <span class="stats__bar-cell">
                  <span class="stats__bar" :style="{ width: `${(row.openers / maxOpeners) * BAR_WIDTH}px` }" />
                  {{ formatNumber(row.openers) }}
                </span>
              </td>
              <td class="admin-table__number" data-label="Начали">{{ formatNumber(row.started) }}</td>
              <td class="admin-table__number" data-label="Завершили">{{ formatNumber(row.completed) }}</td>
              <td class="admin-table__number" data-label="До конца">{{ formatShare(row.completed, row.started) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.stats__country {
  flex: 1 1 220px;
  max-width: 320px;
}

.stats__sort {
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;

  &:hover {
    color: $color-ink;
  }
}

.stats__art {
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.stats__thumb {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  object-fit: contain;
}

.stats__bar-cell {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 140px;
}

.stats__bar {
  height: 8px;
  min-width: 2px;
  border-radius: 4px;
  background: $color-progress;
}

.stats__sort-select {
  display: none;
}

@media (max-width: 600px) {
  .stats__sort-select {
    display: flex;
  }

  .stats__table {
    thead {
      display: none;
    }

    tbody {
      display: block;
    }

    tr {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px 8px;
      padding: 12px 14px;
      border-bottom: 1px solid #eef2f6;
    }

    tr:last-child {
      border-bottom: 0;
    }

    td {
      padding: 0;
      border: 0;
      text-align: left;
      font-variant-numeric: tabular-nums;
    }

    td:first-child {
      grid-column: 1 / -1;
    }

    td[data-label]::before {
      content: attr(data-label);
      display: block;
      margin-bottom: 2px;
      color: rgba($color-ink, 0.6);
      font-size: 12px;
    }
  }

  .stats__bar-cell {
    width: auto;
  }

  .stats__bar {
    display: none;
  }
}
</style>
