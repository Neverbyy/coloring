<script setup lang="ts">
defineProps<{ label: string, country: string }>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <li class="admin-chip">
    <img class="admin-flag" :src="flagUrl(country)" alt="" width="20" height="15">
    {{ label }}
    <button type="button" :aria-label="`Убрать ${label}`" @click="$emit('remove')">×</button>
  </li>
</template>
