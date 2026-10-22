<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import type { AdminDrawing } from '../../../../../shared/admin'

const route = useRoute()
const userId = computed(() => String(route.params.id))

const { data: drawings, isPending, error } = useQuery({
  queryKey: computed(() => ['admin', 'coloring', 'player-drawings', userId.value]),
  queryFn: () => adminFetch<AdminDrawing[]>(`/api/admin/coloring/users/${encodeURIComponent(userId.value)}/arts`)
})

const opened = ref<AdminDrawing | null>(null)

function statusText(drawing: AdminDrawing): string {
  if (drawing.completedAt) return `Дошёл до 100% ${formatDateTime(drawing.completedAt)}`
  if (drawing.startedAt) return `Рисует · изменён ${formatDateTime(drawing.updatedAt)}`
  if (drawing.lastOpenedAt) return `Открывал ${formatDateTime(drawing.lastOpenedAt)}, не рисовал`
  return 'Ещё не открывал'
}
</script>

<template>
  <section class="player-drawings" aria-label="Рисунки игрока">
    <p v-if="error" class="admin-notice admin-notice--danger">{{ errorMessage(error, 'Не удалось загрузить рисунки') }}</p>
    <p v-else-if="isPending" class="admin-empty">Загружаем…</p>
    <p v-else-if="!drawings?.length" class="admin-empty">Игрок ещё не открывал раскраски</p>
    <ul v-else class="player-drawings__grid">
      <li v-for="drawing in drawings" :key="drawing.art.id">
        <button
          type="button"
          class="admin-card player-drawings__card"
          :disabled="!drawing.drawn"
          :title="drawing.drawn ? 'Открыть рисунок' : 'Игрок ещё не рисовал'"
          @click="opened = drawing"
        >
          <ColoringThumbnail
            class="player-drawings__art"
            :title="drawing.art.title"
            :image="drawing.art.image"
            :width="drawing.art.width"
            :height="drawing.art.height"
            :thumbnail="drawing.thumbnail"
          />
          <span class="player-drawings__title">
            {{ drawing.art.title }}
            <span v-if="drawing.art.own" class="admin-badge admin-badge--blue">свой</span>
            <span v-if="drawing.art.status !== 'published'" class="admin-badge">скрыт</span>
          </span>
          <span class="player-drawings__progress" :aria-label="`Заполнено ${Math.floor(drawing.progress)}%`">
            <span class="player-drawings__bar">
              <span :style="{ width: `${Math.min(100, drawing.progress)}%` }" :class="{ done: drawing.completedAt }" />
            </span>
            {{ Math.floor(drawing.progress) }}%
          </span>
          <span class="admin-muted player-drawings__status">{{ statusText(drawing) }}</span>
        </button>
      </li>
    </ul>

    <ColoringAdminDrawingViewer v-if="opened" :user-id="userId" :drawing="opened" @close="opened = null" />
  </section>
</template>

<style scoped lang="scss">
.player-drawings__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.player-drawings__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 14px;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover:not(:disabled) {
    border-color: $color-progress;
    box-shadow: 0 4px 14px rgba($color-ink, 0.08);
  }

  &:disabled {
    cursor: default;
  }
}

.player-drawings__art {
  height: 160px;
  border-radius: 8px;
  background: #fff;
  box-shadow: inset 0 0 0 1px #e2e8f0;
}

.player-drawings__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}

.player-drawings__progress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.player-drawings__bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #eef2f6;
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    background: $color-progress;
  }

  .done {
    background: $color-accent;
  }
}

.player-drawings__status {
  font-size: 13px;
}

@media (max-width: 480px) {
  .player-drawings__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .player-drawings__card {
    gap: 6px;
    padding: 10px;
  }

  .player-drawings__art {
    height: 110px;
  }

  .player-drawings__title {
    font-size: 14px;
  }

  .player-drawings__status {
    font-size: 12px;
  }
}
</style>
