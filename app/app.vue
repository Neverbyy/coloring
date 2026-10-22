<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
  <OrientationGuard v-if="!route.meta.admin" />
</template>
