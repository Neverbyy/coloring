import { useQueryClient } from '@tanstack/vue-query'
import { ARTS_API, IMPORT_MESSAGES, artApiPath, type GalleryArt, type ImportResult } from '../../shared/gallery'
import { paperGeometry } from '../../shared/history'
import { forgetPending, pendingStorageKey } from '../engine/sync'

const MESSAGES = {
  ...IMPORT_MESSAGES,
  noAreas: 'Не нашли областей для раскрашивания — замкни контуры фигур',
  broken: 'Не получилось показать рисунок — файл повреждён или не поддерживается',
  network: 'Не получилось загрузить — проверь интернет и попробуй ещё раз',
  deleteFailed: 'Не получилось удалить — проверь интернет и попробуй ещё раз'
}

export class OwnArtError extends Error {}

async function countAreas(art: GalleryArt): Promise<number> {
  return paintableAreas(segmentArt(await loadImage(art.image), paperGeometry(art.width, art.height)))
}

export function useOwnArts() {
  const queryClient = useQueryClient()
  const auth = useAuthStore()
  const previews = useDrawingPreviews()
  const importing = ref(false)

  async function remove(id: string) {
    await $fetch(artApiPath(id), { method: 'DELETE' })
  }

  async function importArt(file: File): Promise<ImportResult> {
    const problem = svgFileProblem(file)
    if (problem) throw new OwnArtError(problem)

    importing.value = true
    try {
      let result: ImportResult
      try {
        result = await $fetch<ImportResult>(ARTS_API, {
          method: 'POST',
          query: { name: file.name },
          headers: { 'content-type': 'image/svg+xml' },
          body: file
        })
      } catch (error) {
        throw new OwnArtError(errorMessage(error, MESSAGES.network))
      }

      let areas = 0
      try {
        areas = await countAreas(result.art)
      } catch {
        await remove(result.art.id).catch(() => {})
        throw new OwnArtError(MESSAGES.broken)
      }
      if (areas === 0) {
        await remove(result.art.id).catch(() => {})
        throw new OwnArtError(MESSAGES.noAreas)
      }

      await invalidateGallery(queryClient)
      return result
    } finally {
      importing.value = false
    }
  }

  async function deleteArt(art: GalleryArt) {
    try {
      await remove(art.id)
    } catch (error) {
      if (errorStatus(error) !== 404) throw new OwnArtError(errorMessage(error, MESSAGES.deleteFailed))
    }
    previews.remove(art.id)
    forgetDrawing(queryClient, art.id)
    if (auth.user) forgetPending(pendingStorageKey(auth.user.id, art.id))
    await invalidateGallery(queryClient)
  }

  return { importing: readonly(importing), importArt, deleteArt }
}
