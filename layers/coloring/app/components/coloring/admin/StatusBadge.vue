<script setup lang="ts">
import type { ArtStatus } from '#layers/coloring/shared/admin'

defineProps<{ status: ArtStatus }>()

const LABELS: Record<ArtStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  hidden: 'Скрыт'
}
</script>

<template>
  <span
    class="admin-badge"
    :class="{ 'admin-badge--green': status === 'published', 'admin-badge--amber': status === 'draft' }"
  >
    {{ LABELS[status] }}
  </span>
</template>
