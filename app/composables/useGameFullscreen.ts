// Полноэкранный режим игры на телефоне: прячет панель браузера и системные кнопки,
// на Android ещё и фиксирует горизонтальную ориентацию. Браузер разрешает его только
// в ответ на действие пользователя (нажатие). На iPhone Fullscreen API для страниц нет —
// там просто ничего не происходит

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
}

let listening = false
let entered = false
let locked = false
// Игрок сам вышел из полноэкранного режима — не навязываем его до следующего открытия арта
let exitedByUser = false

function isSupported(): boolean {
  return import.meta.client
    && window.matchMedia('(pointer: coarse)').matches
    && typeof document.documentElement.requestFullscreen === 'function'
}

function listen() {
  if (listening) return
  listening = true
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      entered = true
    } else {
      if (entered) exitedByUser = true
      entered = false
      locked = false
    }
  })
}

// explicit — игрок сам открыл арт (нажал карточку): снова предлагаем полный экран
export async function requestGameFullscreen(explicit = false): Promise<void> {
  if (!isSupported()) return
  listen()
  if (explicit) exitedByUser = false
  if (exitedByUser || (document.fullscreenElement && locked)) return

  if (!document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    } catch {
      return
    }
  }

  try {
    await (screen.orientation as LockableOrientation).lock?.('landscape')
    locked = true
  } catch {
    // Фиксация ориентации поддерживается не везде — играть можно и без неё
  }
}

// Для экрана игры: если вошли без нажатия на карточку (ссылка, перезагрузка) —
// включаем полный экран по первому касанию. При уходе с экрана снимаем фиксацию ориентации
export function useGameFullscreen() {
  const onPointerUp = () => requestGameFullscreen()

  onMounted(() => {
    if (isSupported()) window.addEventListener('pointerup', onPointerUp)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointerup', onPointerUp)
    if (locked) {
      screen.orientation?.unlock?.()
      locked = false
    }
  })
}
