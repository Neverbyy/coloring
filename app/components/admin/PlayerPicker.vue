<script setup lang="ts">
const model = defineModel<AdminPlayer[]>({ required: true })

const MAX_RESULTS = 8

const query = ref('')
const results = ref<AdminPlayer[]>([])
const open = ref(false)
const searching = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let requestId = 0
let nobodyFor: string | null = null

watch(query, (value) => {
  clearTimeout(timer)
  requestId++
  results.value = []
  const q = value.trim()
  if (!q || (nobodyFor !== null && q.toLocaleLowerCase().includes(nobodyFor))) {
    searching.value = false
    return
  }
  searching.value = true
  timer = setTimeout(() => search(q), ADMIN_SEARCH_DELAY_MS)
})

async function search(q: string) {
  const id = ++requestId
  try {
    const page = await adminFetch<AdminPlayerPage>('/api/admin/users', { query: { q } })
    if (id !== requestId) return
    nobodyFor = page.items.length ? null : q.toLocaleLowerCase()
    const chosen = new Set(model.value.map(player => player.id))
    results.value = page.items.filter(player => !chosen.has(player.id)).slice(0, MAX_RESULTS)
    open.value = true
  } catch {
    if (id === requestId) results.value = []
  } finally {
    if (id === requestId) searching.value = false
  }
}

function add(player: AdminPlayer) {
  model.value = [...model.value, player]
  query.value = ''
  results.value = []
}

function remove(id: string) {
  model.value = model.value.filter(player => player.id !== id)
}

function onEnter() {
  if (results.value[0]) add(results.value[0])
}

function onBlur() {
  setTimeout(() => {
    open.value = false
  }, 150)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="player-picker">
    <ul v-if="model.length" class="admin-chips">
      <AdminChip
        v-for="player in model"
        :key="player.id"
        :label="player.username"
        :country="player.country"
        @remove="remove(player.id)"
      />
    </ul>
    <div class="player-picker__search">
      <input
        v-model="query"
        class="admin-input player-picker__input"
        type="search"
        placeholder="Найти игрока по имени…"
        aria-label="Найти игрока по имени"
        autocomplete="off"
        @focus="open = true"
        @blur="onBlur"
        @keydown.enter.prevent="onEnter"
      >
      <ul v-if="open && query.trim()" class="player-picker__results" role="listbox">
        <li v-if="searching" class="player-picker__empty">Ищем…</li>
        <li v-else-if="!results.length" class="player-picker__empty">Никого не нашли</li>
        <li v-for="player in results" :key="player.id">
          <button type="button" class="player-picker__option" @mousedown.prevent="add(player)">
            <img class="admin-flag" :src="flagUrl(player.country)" alt="" width="20" height="15">
            {{ player.username }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
.player-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.player-picker__search {
  position: relative;
}

.player-picker__input {
  width: 100%;
}

.player-picker__results {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  z-index: 10;
  max-height: 280px;
  padding: 4px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba($color-ink, 0.12);
}

.player-picker__option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  text-align: left;

  &:hover {
    background: #f1f5fa;
  }
}

.player-picker__empty {
  padding: 8px 10px;
  color: rgba($color-ink, 0.6);
}
</style>
