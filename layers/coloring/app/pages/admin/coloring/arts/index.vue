<script setup lang="ts">
import { useInfiniteQuery, useQueryClient } from '@tanstack/vue-query'
import {
  ADMIN_ARTS_API,
  type AdminArt,
  type AdminArtPage,
  type AdminArtUpload,
  type ArtStatusFilter
} from '#layers/coloring/shared/admin'

useHead({ title: 'Раскраски' })

const FILTERS: { value: ArtStatusFilter, label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'published', label: 'Опубликованные' },
  { value: 'hidden', label: 'Скрытые' },
  { value: 'draft', label: 'Черновики' }
]
const filter = ref<ArtStatusFilter>('all')

const queryClient = useQueryClient()
const { data, isPending, error, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
  queryKey: computed(() => ['admin', 'coloring', 'arts', filter.value] as const),
  queryFn: ({ queryKey, pageParam }) => adminFetch<AdminArtPage>(ADMIN_ARTS_API, { query: { status: queryKey[3], page: pageParam } }),
  initialPageParam: 1,
  getNextPageParam: (last: AdminArtPage) => last.page < last.pageCount ? last.page + 1 : undefined
})

const arts = computed(() => data.value?.pages.flatMap(page => page.items) ?? [])

const statusCounts = ref<AdminArtPage['statusCounts'] | null>(null)
watch(data, (value) => {
  const last = value?.pages.at(-1)
  if (last) statusCounts.value = last.statusCounts
}, { immediate: true })
const total = computed(() => statusCounts.value?.[filter.value] ?? 0)

function audienceText(art: AdminArt): string {
  if (art.audience === 'all') return 'Всем игрокам'
  const parts = [
    art.countryCount ? plural(art.countryCount, ['страна', 'страны', 'стран']) : '',
    art.playerCount ? plural(art.playerCount, ['игрок', 'игрока', 'игроков']) : ''
  ].filter(Boolean)
  return parts.length ? `Выбранным: ${parts.join(', ')}` : 'Никому не назначен'
}

const uploadNotes = useState<Record<string, string[]>>('admin-upload-notes', () => ({}))
const uploading = ref(false)
const uploadError = ref('')
const duplicateId = ref<string | null>(null)
const dragging = ref(false)

async function upload(file: File) {
  uploadError.value = ''
  duplicateId.value = null
  const problem = svgFileProblem(file)
  if (problem) {
    uploadError.value = problem
    return
  }
  uploading.value = true
  try {
    const result = await adminFetch<AdminArtUpload>(ADMIN_ARTS_API, {
      method: 'POST',
      query: { name: file.name },
      headers: { 'content-type': 'image/svg+xml' },
      body: file
    })
    uploadNotes.value[result.id] = result.notes
    await queryClient.invalidateQueries({ queryKey: ['admin', 'coloring'] })
    await navigateTo(`/admin/coloring/arts/${result.id}`)
  } catch (failure) {
    uploadError.value = errorMessage(failure, 'Не удалось загрузить файл — попробуйте ещё раз')
    const data = (failure as { data?: { data?: { id?: unknown } } }).data?.data
    if (errorStatus(failure) === 409 && typeof data?.id === 'string') duplicateId.value = data.id
  } finally {
    uploading.value = false
  }
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) upload(file)
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file && !uploading.value) upload(file)
}
</script>

<template>
  <div class="admin-page">
    <header class="admin-page__header">
      <h1 class="admin-title">Раскраски</h1>
    </header>

    <label
      class="admin-card arts-upload"
      :class="{ 'arts-upload--dragging': dragging, 'arts-upload--busy': uploading }"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input class="visually-hidden" type="file" accept=".svg,image/svg+xml" :disabled="uploading" @change="onPick">
      <span class="arts-upload__title">{{ uploading ? 'Загружаем и готовим к раскраске…' : 'Загрузить SVG' }}</span>
      <span class="admin-muted">
        Перетащите файл сюда или нажмите, чтобы выбрать. Рисунок из Figma — пером или фигурами, до 1 МБ.
        Новая раскраска появится черновиком: игроки увидят её после публикации
      </span>
    </label>
    <p v-if="uploadError" class="admin-notice admin-notice--danger" role="alert">
      {{ uploadError }}
      <NuxtLink v-if="duplicateId" :to="`/admin/coloring/arts/${duplicateId}`">Открыть</NuxtLink>
    </p>

    <nav class="admin-tabs" aria-label="Статус">
      <button
        v-for="item in FILTERS"
        :key="item.value"
        type="button"
        class="admin-tab"
        :class="{ 'admin-tab--active': filter === item.value }"
        :aria-pressed="filter === item.value"
        @click="filter = item.value"
      >
        {{ item.label }} <span v-if="statusCounts" class="admin-muted">{{ statusCounts[item.value] }}</span>
      </button>
    </nav>

    <p v-if="error" class="admin-notice admin-notice--danger">{{ errorMessage(error, 'Не удалось загрузить раскраски') }}</p>
    <p v-else-if="isPending" class="admin-empty">Загружаем…</p>
    <p v-else-if="!arts.length" class="admin-empty">Здесь пока пусто</p>
    <ul v-else class="arts-grid">
      <li v-for="art in arts" :key="art.id">
        <NuxtLink :to="`/admin/coloring/arts/${art.id}`" class="admin-card arts-card">
          <span class="arts-card__image">
            <img :src="art.image" :alt="art.title" loading="lazy">
          </span>
          <span class="arts-card__title">{{ art.title }}</span>
          <span class="arts-card__badges">
            <ColoringAdminStatusBadge :status="art.status" />
            <span class="admin-badge" :class="{ 'admin-badge--blue': art.audience === 'assigned' }">{{ audienceText(art) }}</span>
          </span>
          <span class="admin-muted arts-card__counts">
            <span>Открыли {{ art.counts.openers }}</span> · <span>начали {{ art.counts.started }}</span> ·
            <span>завершили {{ art.counts.completed }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>

    <div v-if="!error && hasNextPage" class="arts-more">
      <button type="button" class="admin-button" :disabled="isFetchingNextPage" @click="fetchNextPage()">
        {{ isFetchingNextPage ? 'Загружаем…' : 'Показать ещё' }}
      </button>
      <span class="admin-muted">Показано {{ arts.length }} из {{ total }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.arts-upload {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 24px;
  border: 2px dashed #c5d0dc;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;

  &:hover,
  &:focus-within {
    border-color: $color-progress;
  }
}

.arts-upload--dragging {
  border-color: $color-progress;
  background: #f0f8fe;
}

.arts-upload--busy {
  cursor: progress;
}

.arts-upload__title {
  font: 700 17px/1.3 $font-body;
}

.arts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

.arts-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 14px;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: $color-progress;
    box-shadow: 0 4px 14px rgba($color-ink, 0.08);
  }
}

.arts-card__image {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  padding: 8px;
  border-radius: 8px;
  background: #f7f9fc;

  img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.arts-card__title {
  font-weight: 700;
}

.arts-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.arts-card__counts {
  margin-top: auto;
  font-size: 13px;

  span {
    white-space: nowrap;
  }
}

.arts-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

@media (max-width: 480px) {
  .arts-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .arts-card {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    grid-template-rows: auto auto 1fr;
    gap: 6px 12px;
    padding: 10px;
  }

  .arts-card__image {
    grid-row: 1 / 4;
    align-self: start;
    aspect-ratio: 1;
    padding: 4px;
  }

  .arts-card__counts {
    margin-top: 0;
    font-size: 12px;
  }
}
</style>
