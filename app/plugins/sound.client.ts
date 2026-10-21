// Звук приложения: разрешение звука на первом жесте, щелчок на кнопках, фоновая музыка экранов

// Что щёлкает: кнопки, ссылки (карточки, пагинация), пункты списков, подписи-кнопки (карточка «+»)
const CLICKABLE = 'button, a[href], [role="button"], [role="option"], label'
// <label> с полем файла даёт два click подряд — второй не озвучиваем
const CLICK_THROTTLE_MS = 60

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const audio = useAudioStore()
  preloadSounds([UI_SOUNDS.click])

  // Браузер разрешает звук только после жеста игрока
  const onGesture = () => {
    unlockAudio()
    resumeMusic()
  }
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true })
  window.addEventListener('keydown', onGesture, { capture: true })

  // Один обработчик на всё приложение: click, а не pointerdown — свайп по карточкам не щёлкает,
  // отключённые кнопки событие не получают. data-silent — без щелчка
  let lastClick = 0
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest(CLICKABLE) : null
    if (!target || target.closest('[data-silent]')) return
    const now = performance.now()
    if (now - lastClick < CLICK_THROTTLE_MS) return
    lastClick = now
    playSound(UI_SOUNDS.click)
  }, { capture: true })

  // Музыка — у экранов с meta.music, если игрок её не выключил и вкладка на виду
  const update = () => {
    const src = router.currentRoute.value.meta.music
    setMusic(audio.musicOn && document.visibilityState === 'visible' && src ? src : null)
  }
  watch(() => [router.currentRoute.value.meta.music, audio.musicOn], update, { immediate: true })
  document.addEventListener('visibilitychange', update)
})
