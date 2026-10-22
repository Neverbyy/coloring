export interface DrawingPreview {
  thumbnail: string
  progress: number
}

const previews = reactive(new Map<string, DrawingPreview>())

export function useDrawingPreviews() {
  const auth = useAuthStore()
  const key = (artId: string) => `${auth.user?.id ?? ''}:${artId}`

  function get(artId: string): DrawingPreview | undefined {
    return previews.get(key(artId))
  }

  function set(artId: string, image: Blob, progress: number) {
    const previous = previews.get(key(artId))
    previews.set(key(artId), { thumbnail: URL.createObjectURL(image), progress })
    if (previous) URL.revokeObjectURL(previous.thumbnail)
  }

  function remove(artId: string) {
    const previous = previews.get(key(artId))
    if (!previous) return
    previews.delete(key(artId))
    URL.revokeObjectURL(previous.thumbnail)
  }

  return { get, set, remove }
}
