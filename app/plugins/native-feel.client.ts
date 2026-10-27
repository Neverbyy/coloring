export default defineNuxtPlugin(() => {
  if (!isTouchDevice()) return

  const router = useRouter()
  const inGame = () => !router.currentRoute.value.meta.admin
  const prevent = (event: Event) => {
    if (inGame()) event.preventDefault()
  }

  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  document.addEventListener('contextmenu', prevent)
  document.addEventListener('dragstart', prevent)
  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1 && event.cancelable && inGame()) event.preventDefault()
  }, { passive: false })
})
