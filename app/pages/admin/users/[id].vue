<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

const route = useRoute()
const id = computed(() => String(route.params.id))
const { admin: adminConfig } = useAppConfig()
const countryName = useCountryName()

const { data: player, error } = useQuery({
  queryKey: computed(() => ['admin', 'player', id.value]),
  queryFn: () => adminFetch<AdminPlayer>(`/api/admin/users/${encodeURIComponent(id.value)}`)
})

useHead({ title: () => player.value?.username ?? 'Игрок' })
</script>

<template>
  <div class="admin-page">
    <NuxtLink to="/admin/users" class="admin-muted admin-back">← Все игроки</NuxtLink>

    <p v-if="error" class="admin-notice admin-notice--danger">
      {{ errorStatus(error) === 404 ? 'Такого игрока нет' : errorMessage(error, 'Не удалось загрузить игрока') }}
    </p>

    <template v-else>
      <header class="admin-page__header">
        <div>
          <h1 class="admin-title">{{ player?.username ?? '…' }}</h1>
          <p v-if="player" class="admin-muted player__meta">
            <img class="admin-flag" :src="flagUrl(player.country)" alt="" width="20" height="15">
            {{ countryName(player.country) }} · в игре с {{ formatDate(player.createdAt) }}
          </p>
        </div>
      </header>

      <nav v-if="adminConfig.userTabs.length > 1" class="admin-tabs" aria-label="Игры">
        <NuxtLink v-for="tab in adminConfig.userTabs" :key="tab.path" class="admin-tab" :to="`/admin/users/${id}/${tab.path}`">
          {{ tab.label }}
        </NuxtLink>
      </nav>

      <NuxtPage />
    </template>
  </div>
</template>

<style scoped lang="scss">
.player__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
</style>
