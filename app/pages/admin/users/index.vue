<script setup lang="ts">
import { keepPreviousData, useQuery } from '@tanstack/vue-query'

useHead({ title: 'Игроки' })

const route = useRoute()
const router = useRouter()
const filters = computed(() => ({
  q: typeof route.query.q === 'string' ? route.query.q : '',
  country: typeof route.query.country === 'string' ? route.query.country : '',
  page: Math.max(1, Number(route.query.page) || 1)
}))

function setFilters(next: Partial<{ q: string, country: string, page: number }>) {
  const merged = { ...filters.value, page: 1, ...next }
  router.replace({
    query: {
      q: merged.q || undefined,
      country: merged.country || undefined,
      page: merged.page > 1 ? String(merged.page) : undefined
    }
  })
}

const search = ref(filters.value.q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => setFilters({ q: value.trim() }), ADMIN_SEARCH_DELAY_MS)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const countries = useCountryOptions()
const countryName = useCountryName()

const { data, isPending, error } = useQuery({
  queryKey: computed(() => ['admin', 'players', filters.value]),
  queryFn: () => adminFetch<AdminPlayerPage>('/api/admin/users', {
    query: { q: filters.value.q || undefined, country: filters.value.country || undefined, page: filters.value.page }
  }),
  placeholderData: keepPreviousData
})

function open(player: AdminPlayer) {
  return navigateTo(`/admin/users/${player.id}`)
}
</script>

<template>
  <div class="admin-page">
    <header class="admin-page__header">
      <h1 class="admin-title">
        Игроки
        <span v-if="data" class="admin-muted players__total">{{ formatNumber(data.total) }}</span>
      </h1>
    </header>

    <div class="admin-toolbar">
      <input
        v-model="search"
        class="admin-input players__search"
        type="search"
        placeholder="Поиск по имени"
        aria-label="Поиск по имени"
      >
      <CountrySelect
        class="players__country-filter"
        :model-value="filters.country"
        :options="countries"
        clear-label="Все страны"
        label="Страна"
        compact
        @update:model-value="setFilters({ country: $event })"
      />
    </div>

    <p v-if="error" class="admin-notice admin-notice--danger">{{ errorMessage(error, 'Не удалось загрузить игроков') }}</p>
    <p v-else-if="isPending" class="admin-empty">Загружаем…</p>
    <p v-else-if="!data?.items.length" class="admin-empty">Никого не нашли</p>
    <div v-else class="admin-table-wrap">
      <table class="admin-table admin-table--cards">
        <thead>
          <tr>
            <th>Игрок</th>
            <th>Страна</th>
            <th>В игре с</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in data.items" :key="player.id" class="admin-table__row-link" @click="open(player)">
            <td>
              <NuxtLink :to="`/admin/users/${player.id}`" class="players__name" @click.stop>{{ player.username }}</NuxtLink>
            </td>
            <td>
              <span class="players__country">
                <img class="admin-flag" :src="flagUrl(player.country)" alt="" width="20" height="15">
                {{ countryName(player.country) }}
              </span>
            </td>
            <td class="admin-muted" data-label="В игре с">{{ formatDateTime(player.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav v-if="data && data.pageCount > 1" class="admin-pagination" aria-label="Страницы">
      <button type="button" class="admin-button admin-button--small" :disabled="data.page <= 1" @click="setFilters({ page: data.page - 1 })">
        ← Назад
      </button>
      <span class="admin-muted">{{ data.page }} из {{ data.pageCount }}</span>
      <button type="button" class="admin-button admin-button--small" :disabled="data.page >= data.pageCount" @click="setFilters({ page: data.page + 1 })">
        Вперёд →
      </button>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.players__total {
  margin-left: 6px;
  font-size: 20px;
}

.players__search {
  flex: 1 1 240px;
  max-width: 360px;
}

.players__country-filter {
  flex: 1 1 220px;
  max-width: 320px;
}

.players__name {
  color: inherit;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.players__country {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
</style>
