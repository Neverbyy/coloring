<script setup lang="ts">
import { adminDrawingApiPath, type AdminDrawing } from '../../../../shared/admin'
import { paperGeometry, type DrawingState } from '../../../../shared/history'
import { ColoringEngine } from '../../../engine/engine'

const props = defineProps<{ userId: string, drawing: AdminDrawing }>()
const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const imageUrl = ref<string | null>(null)
const error = ref('')

const art = computed(() => props.drawing.art)

async function render() {
  const path = (suffix: string) => adminDrawingApiPath(props.userId, art.value.id, suffix)
  const [drawingState, lineArt] = await Promise.all([
    adminFetch<DrawingState>(path('/state')),
    loadImage(art.value.image)
  ])
  const paper = paperGeometry(art.value.width, art.value.height)
  const engine = ColoringEngine.offscreen(segmentArt(lineArt, paper))
  if (drawingState.hasBase) {
    const base = await createImageBitmap(await adminFetch<Blob>(path('/base'), { responseType: 'blob' }))
    engine.restore(base)
    base.close()
  }
  for (const op of drawingState.ops.slice(0, drawingState.cursor - drawingState.baseSeq)) engine.apply(op, false)
  const png = await engine.exportImage(lineArt, { x: paper.art.x, y: paper.art.y, w: paper.art.width, h: paper.art.height })
  imageUrl.value = URL.createObjectURL(png)
}

onMounted(() => {
  dialog.value?.showModal()
  render().catch((failure) => {
    error.value = errorMessage(failure, 'Не удалось собрать рисунок')
  })
})

onBeforeUnmount(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <dialog ref="dialog" class="drawing-viewer" :aria-label="art.title" @close="emit('close')" @click.self="dialog?.close()">
    <div class="drawing-viewer__body">
      <header class="drawing-viewer__header">
        <h2 class="admin-card__title drawing-viewer__title">{{ art.title }}</h2>
        <button type="button" class="admin-button admin-button--small" @click="dialog?.close()">Закрыть</button>
      </header>

      <div class="drawing-viewer__picture" :style="{ aspectRatio: `${art.width} / ${art.height}` }">
        <img v-if="imageUrl" :src="imageUrl" :alt="art.title">
        <p v-else-if="error" class="admin-error">{{ error }}</p>
        <p v-else class="admin-muted">Собираем рисунок…</p>
      </div>

      <dl class="drawing-viewer__facts">
        <div>
          <dt>Заполнено</dt>
          <dd>{{ Math.floor(drawing.progress) }}%</dd>
        </div>
        <div>
          <dt>Начал</dt>
          <dd>{{ formatDateTime(drawing.startedAt) }}</dd>
        </div>
        <div>
          <dt>Завершил</dt>
          <dd>{{ formatDateTime(drawing.completedAt) }}</dd>
        </div>
        <div>
          <dt>Последнее изменение</dt>
          <dd>{{ formatDateTime(drawing.updatedAt) }}</dd>
        </div>
      </dl>

      <a
        v-if="imageUrl"
        class="admin-button drawing-viewer__download"
        :href="imageUrl"
        :download="`${art.title}.png`"
      >
        Скачать PNG
      </a>
    </div>
  </dialog>
</template>

<style scoped lang="scss">
.drawing-viewer {
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 0;
  border-radius: 14px;
  color: inherit;

  &::backdrop {
    background: rgba($color-ink, 0.45);
  }
}

.drawing-viewer__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}

.drawing-viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawing-viewer__title {
  margin: 0;
}

.drawing-viewer__picture {
  display: grid;
  place-items: center;
  max-height: 60dvh;
  margin: 0 auto;
  max-width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.drawing-viewer__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin: 0;

  dt {
    color: rgba($color-ink, 0.6);
    font-size: 12px;
    font-weight: 600;
  }

  dd {
    margin: 2px 0 0;
  }
}

.drawing-viewer__download {
  align-self: flex-start;
}
</style>
