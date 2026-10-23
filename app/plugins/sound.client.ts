const CLICKABLE = 'button, a[href], [role="button"], [role="option"], label'
const CLICK_THROTTLE_MS = 60

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const audio = useAudioStore()
  preloadSounds([UI_SOUNDS.click])

  const onGesture = () => {
    unlockAudio()
    resumeMusic()
  }
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true })
  window.addEventListener('keydown', onGesture, { capture: true })

  let lastClick = 0
  document.addEventListener('click', (event) => {
    if (router.currentRoute.value.meta.admin) return
    const target = event.target instanceof Element ? event.target.closest(CLICKABLE) : null
    if (!target || target.closest('[data-silent]')) return
    const now = performance.now()
    if (now - lastClick < CLICK_THROTTLE_MS) return
    lastClick = now
    playSound(UI_SOUNDS.click)
  }, { capture: true })

  const update = () => {
    if (document.visibilityState === 'hidden') {
      suspendAudio()
      return
    }
    const src = router.currentRoute.value.meta.music
    setMusic(audio.musicOn && src ? src : null)
  }
  watch(() => [router.currentRoute.value.meta.music, audio.musicOn], update, { immediate: true })
  document.addEventListener('visibilitychange', update)
  window.addEventListener('pagehide', suspendAudio)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) update()
  })
})
