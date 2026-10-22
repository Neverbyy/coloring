<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

useHead({ title: 'Обзор' })

const { admin: adminConfig } = useAppConfig()
const sections = computed(() => adminConfig.sections.filter(section => section.to !== ADMIN_HOME_PATH))

const { data: players } = useQuery({
  queryKey: ['admin', 'players', 'total'],
  queryFn: () => adminFetch<AdminPlayerPage>('/api/admin/users')
})
</script>

<template>
  <div class="admin-page">
    <header class="admin-page__header">
      <h1 class="admin-title">Обзор</h1>
    </header>

    <div class="admin-tiles">
      <div class="admin-tile">
        <div class="admin-tile__value">{{ players ? formatNumber(players.total) : '…' }}</div>
        <div class="admin-tile__label">игроков</div>
      </div>
    </div>

    <div class="admin-overview">
      <NuxtLink v-for="section in sections" :key="section.to" :to="section.to" class="admin-card admin-overview__link">
        {{ section.label }}
        <span aria-hidden="true">→</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped lang="scss">
.admin-overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.admin-overview__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: inherit;
  font: 700 17px/1.3 $font-body;
  text-decoration: none;
  transition: border-color 0.15s;

  &:hover {
    border-color: $color-progress;
  }
}
</style>
