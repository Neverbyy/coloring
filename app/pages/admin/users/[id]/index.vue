<script setup lang="ts">
const route = useRoute()
const { admin: adminConfig } = useAppConfig()
const first = adminConfig.userTabs[0]
if (first) await navigateTo(`/admin/users/${route.params.id}/${first.path}`, { replace: true })
</script>

<template>
  <p class="admin-empty">Данных игр по этому игроку нет</p>
</template>
