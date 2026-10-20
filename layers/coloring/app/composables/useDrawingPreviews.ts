export interface DrawingPreview {
  // Адрес миниатюры в памяти браузера (blob:)
  thumbnail: string
  progress: number
}

// Свежие миниатюры и проценты рисунков, нарисованных в этой вкладке. Галерея показывает их
// сразу, не дожидаясь ответа сервера. Только в браузере: на сервере всегда пусто
const previews = reactive(new Map<string, DrawingPreview>())

export function useDrawingPreviews() {
  const auth = useAuthStore()
  // Свои у каждого игрока: смена игрока во вкладке не покажет чужие рисунки
  const key = (artId: string) => `${auth.user?.id ?? ''}:${artId}`

  function get(artId: string): DrawingPreview | undefined {
    return previews.get(key(artId))
  }

  function set(artId: string, image: Blob, progress: number) {
    const previous = previews.get(key(artId))
    previews.set(key(artId), { thumbnail: URL.createObjectURL(image), progress })
    if (previous) URL.revokeObjectURL(previous.thumbnail)
  }

  return { get, set }
}
