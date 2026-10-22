<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { MAX_ART_TITLE } from '#layers/coloring/shared/gallery'
import { adminArtApiPath, type AdminArtDetails, type AdminArtPatch, type ArtAudience, type AudienceUpdate } from '#layers/coloring/shared/admin'

const route = useRoute()
const id = computed(() => String(route.params.id))
const queryClient = useQueryClient()
const queryKey = computed(() => ['admin', 'coloring', 'art', id.value])

const { data: art, error } = useQuery({
  queryKey,
  queryFn: () => adminFetch<AdminArtDetails>(adminArtApiPath(id.value))
})

useHead({ title: () => art.value?.title ?? 'Раскраска' })

const uploadNotes = useState<Record<string, string[]>>('admin-upload-notes', () => ({}))
const notes = computed(() => uploadNotes.value[id.value] ?? [])
onBeforeUnmount(() => {
  delete uploadNotes.value[id.value]
})

const areas = ref<number | null>(null)

function applyResult(next: AdminArtDetails) {
  queryClient.setQueryData(queryKey.value, next)
  queryClient.invalidateQueries({ queryKey: ['admin', 'coloring', 'arts'] })
  queryClient.invalidateQueries({ queryKey: ['admin', 'coloring', 'stats'] })
}

const busy = ref(false)
const actionError = ref('')
const saved = ref('')
let savedTimer: ReturnType<typeof setTimeout> | undefined

async function run(action: () => Promise<void>, done?: string) {
  if (busy.value) return
  busy.value = true
  actionError.value = ''
  saved.value = ''
  try {
    await action()
    if (done) {
      saved.value = done
      clearTimeout(savedTimer)
      savedTimer = setTimeout(() => { saved.value = '' }, 2500)
    }
  } catch (failure) {
    actionError.value = errorMessage(failure, 'Не получилось сохранить — попробуйте ещё раз')
  } finally {
    busy.value = false
  }
}
onBeforeUnmount(() => clearTimeout(savedTimer))

function patch(body: AdminArtPatch, done: string) {
  return run(async () => {
    applyResult(await adminFetch<AdminArtDetails>(adminArtApiPath(id.value), { method: 'PATCH', body }))
  }, done)
}

const title = ref('')
watch(() => art.value?.title, (value) => {
  if (value !== undefined) title.value = value
}, { immediate: true })
const titleChanged = computed(() => !!art.value && title.value.trim() !== art.value.title && title.value.trim() !== '')

const audience = ref<ArtAudience>('all')
const countries = ref<string[]>([])
const players = ref<AdminPlayer[]>([])
function resetAudience(source: AdminArtDetails) {
  audience.value = source.audience
  countries.value = [...source.countries]
  players.value = [...source.players]
}
watch(art, (value) => {
  if (value) resetAudience(value)
}, { immediate: true })

const audienceChanged = computed(() => {
  const value = art.value
  if (!value) return false
  const same = (a: string[], b: string[]) => a.length === b.length && a.every(item => b.includes(item))
  return audience.value !== value.audience
    || !same(countries.value, value.countries)
    || !same(players.value.map(player => player.id), value.players.map(player => player.id))
})

function saveAudience() {
  const body: AudienceUpdate = {
    audience: audience.value,
    countries: countries.value,
    userIds: players.value.map(player => player.id)
  }
  return run(async () => {
    applyResult(await adminFetch<AdminArtDetails>(adminArtApiPath(id.value, '/audience'), { method: 'PUT', body }))
  }, 'Сохранено')
}

function remove() {
  if (!art.value || !window.confirm(`Удалить черновик «${art.value.title}»?`)) return
  return run(async () => {
    await adminFetch(adminArtApiPath(id.value), { method: 'DELETE' })
    queryClient.removeQueries({ queryKey: queryKey.value })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'coloring', 'arts'] })
    await navigateTo('/admin/coloring/arts')
  })
}
</script>

<template>
  <div class="admin-page">
    <NuxtLink to="/admin/coloring/arts" class="admin-muted admin-back">← Все раскраски</NuxtLink>

    <p v-if="error" class="admin-notice admin-notice--danger">
      {{ errorStatus(error) === 404 ? 'Такой раскраски нет' : errorMessage(error, 'Не удалось загрузить раскраску') }}
    </p>

    <template v-else-if="art">
      <header class="admin-page__header">
        <div class="art__heading">
          <h1 class="admin-title">{{ art.title }}</h1>
          <ColoringAdminStatusBadge :status="art.status" />
        </div>
      </header>

      <p v-for="note in notes" :key="note" class="admin-notice">{{ note }}</p>
      <p v-if="actionError" class="admin-notice admin-notice--danger" role="alert">{{ actionError }}</p>

      <div class="art__layout">
        <section class="admin-card art__preview" aria-label="Результат преобразования">
          <div class="art__pictures">
            <figure class="art__picture">
              <figcaption class="admin-field">Контур</figcaption>
              <div class="art__frame" :style="{ aspectRatio: `${art.width} / ${art.height}` }">
                <img :src="art.image" :alt="art.title">
              </div>
            </figure>
            <figure class="art__picture">
              <figcaption class="admin-field">Области для раскраски</figcaption>
              <div class="art__frame">
                <ColoringAdminSegmentsPreview
                  :key="art.image"
                  :image="art.image"
                  :width="art.width"
                  :height="art.height"
                  @analyzed="areas = $event"
                />
              </div>
            </figure>
          </div>
          <p v-if="areas === null" class="admin-muted">Ищем области…</p>
          <p v-else-if="areas === 0" class="admin-notice admin-notice--danger">
            Не найдено ни одной области — раскрашивать нечего. Скорее всего, контуры не замкнуты: удалите черновик и загрузите другой файл.
          </p>
          <p v-else class="admin-muted">
            Найдено {{ plural(areas, ['область', 'области', 'областей']) }}. Каждая выделена своим цветом;
            серое — фон, он в процент заполнения не входит.
          </p>
        </section>

        <div class="art__side">
          <section class="admin-card">
            <h2 class="admin-card__title">Публикация</h2>
            <p class="admin-muted art__hint">
              <template v-if="art.status === 'draft'">Черновик: игроки его не видят. Проверьте результат слева и опубликуйте.</template>
              <template v-else-if="art.status === 'published'">
                Опубликован {{ formatDate(art.publishedAt) }}
                и виден {{ art.audience === 'all' ? 'всем игрокам' : 'только выбранным странам или игрокам' }}.
              </template>
              <template v-else>Скрыт: игроки его не видят. Начатые рисунки сохранены и вернутся после публикации.</template>
            </p>
            <div class="admin-toolbar">
              <button
                v-if="art.status !== 'published'"
                type="button"
                class="admin-button admin-button--primary"
                :disabled="busy"
                @click="patch({ published: true }, 'Опубликовано')"
              >
                {{ art.status === 'draft' ? 'Опубликовать' : 'Опубликовать снова' }}
              </button>
              <button
                v-else
                type="button"
                class="admin-button"
                :disabled="busy"
                @click="patch({ published: false }, 'Скрыто')"
              >
                Скрыть
              </button>
              <button
                v-if="art.status === 'draft'"
                type="button"
                class="admin-button admin-button--danger"
                :disabled="busy"
                @click="remove"
              >
                Удалить черновик
              </button>
            </div>
          </section>

          <form class="admin-card art__form" @submit.prevent="patch({ title: title.trim() }, 'Название сохранено')">
            <h2 class="admin-card__title">Название</h2>
            <div class="admin-toolbar">
              <input v-model="title" class="admin-input art__title-input" :maxlength="MAX_ART_TITLE" aria-label="Название" required>
              <button type="submit" class="admin-button" :disabled="busy || !titleChanged">Сохранить</button>
            </div>
          </form>

          <section class="admin-card art__form">
            <h2 class="admin-card__title">Кому показывать</h2>
            <div class="art__audience" role="radiogroup" aria-label="Кому показывать">
              <label class="art__radio">
                <input v-model="audience" type="radio" value="all">
                Всем игрокам
              </label>
              <label class="art__radio">
                <input v-model="audience" type="radio" value="assigned">
                Только выбранным странам или игрокам
              </label>
            </div>
            <template v-if="audience === 'assigned'">
              <div class="admin-field">
                Страны
                <AdminCountryPicker v-model="countries" />
              </div>
              <div class="admin-field">
                Игроки
                <AdminPlayerPicker v-model="players" />
              </div>
              <p class="admin-muted art__hint">
                Арт увидят игроки из выбранных стран и выбранные игроки.
                <template v-if="!countries.length && !players.length"><b>Сейчас никто не выбран — арт не увидит никто.</b></template>
              </p>
            </template>
            <div class="admin-toolbar">
              <button type="button" class="admin-button admin-button--primary" :disabled="busy || !audienceChanged" @click="saveAudience">
                Сохранить
              </button>
              <button v-if="audienceChanged" type="button" class="admin-button" :disabled="busy" @click="resetAudience(art)">
                Отменить
              </button>
            </div>
          </section>

          <section class="admin-card">
            <h2 class="admin-card__title">Статистика</h2>
            <div class="admin-tiles art__tiles">
              <div class="admin-tile">
                <div class="admin-tile__value">{{ formatNumber(art.counts.openers) }}</div>
                <div class="admin-tile__label">открыли</div>
              </div>
              <div class="admin-tile">
                <div class="admin-tile__value">{{ formatNumber(art.counts.started) }}</div>
                <div class="admin-tile__label">начали</div>
              </div>
              <div class="admin-tile">
                <div class="admin-tile__value">{{ formatNumber(art.counts.completed) }}</div>
                <div class="admin-tile__label">завершили</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <p v-if="saved" class="admin-notice admin-notice--success art__toast" role="status">{{ saved }}</p>
    </template>

    <p v-else class="admin-empty">Загружаем…</p>
  </div>
</template>

<style scoped lang="scss">
.art__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.art__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
  align-items: start;
  gap: 16px;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.art__preview {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.art__pictures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.art__picture {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.art__frame {
  display: grid;
  place-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.art__side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.art__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.art__title-input {
  flex: 1 1 200px;
}

.art__hint {
  margin-bottom: 12px;
  font-size: 14px;
}

.art__form .art__hint {
  margin: 0;
}

.art__audience {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.art__radio {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.art__tiles {
  grid-template-columns: repeat(3, minmax(0, 1fr));

  .admin-tile {
    padding: 12px;
  }
}

.art__toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  z-index: 20;
  transform: translateX(-50%);
  box-shadow: 0 6px 20px rgba($color-ink, 0.15);
}
</style>
