export default defineNuxtPlugin(() => {
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  if (!isTouch) return

  const prevent = (event: Event) => event.preventDefault()

  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  document.addEventListener('contextmenu', prevent)
  document.addEventListener('dragstart', prevent)
  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) event.preventDefault()
  }, { passive: false })
})
