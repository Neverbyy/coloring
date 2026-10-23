import { GALLERY_SIGNAL } from '#layers/coloring/shared/gallery'

export default defineNuxtPlugin((nuxtApp) => {
  const { supabaseUrl, supabasePublishableKey } = useRuntimeConfig().public
  if (!supabaseUrl || !supabasePublishableKey) return

  const auth = useAuthStore()
  let stop: (() => void) | null = null

  watch(() => auth.user?.id, (userId) => {
    stop?.()
    stop = userId
      ? listenSignal({ url: supabaseUrl, key: supabasePublishableKey }, GALLERY_SIGNAL.channel, GALLERY_SIGNAL.event, () => {
          invalidateGallery(nuxtApp.$queryClient)
        })
      : null
  }, { immediate: true })
})
