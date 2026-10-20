// Полноэкранный режим игры на телефоне: прячет панель браузера и системные кнопки,
// на Android ещё и фиксирует вертикальную ориентацию (игра на телефоне только вертикальная).
// Браузер разрешает полный экран только в ответ на действие пользователя (нажатие).
// На iPhone Fullscreen API для страниц нет — там просто ничего не происходит

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'portrait') => Promise<void>
}

interface FullscreenOptions {
  // Игрок сам начал игру (вход, нажатие на карточку): снова предлагаем полный экран,
  // даже если до этого он из него вышел
  explicit?: boolean
}

let listening = false
let entered = false
// Игрок сам вышел из полноэкранного режима — не навязываем его до следующего явного действия
let exitedByUser = false
// Повторный requestFullscreen, пока первый не завершился, браузер отклоняет — переиспользуем
let pending: Promise<boolean> | null = null

function isSupported(): boolean {
  return import.meta.client
    && window.matchMedia('(pointer: coarse)').matches
    && typeof document.documentElement.requestFullscreen === 'function'
}

// Вертикаль фиксируем только на телефонах: планшеты работают в любой ориентации
function isPhone(): boolean {
  return Math.min(screen.width, screen.height) < 600
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
    }
  })
}

function enterFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) return Promise.resolve(true)
  pending ??= document.documentElement
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => true, () => false)
    .finally(() => { pending = null })
  return pending
}

export async function requestGameFullscreen(options: FullscreenOptions = {}): Promise<void> {
  if (!isSupported()) return
  listen()
  if (options.explicit) exitedByUser = false
  if (exitedByUser || document.fullscreenElement) return

  if (!(await enterFullscreen()) || !isPhone()) return

  try {
    // Фиксация снимается сама при выходе из полноэкранного режима
    await (screen.orientation as LockableOrientation).lock?.('portrait')
  } catch {
    // Поддерживается не везде — тогда в горизонтали выручит подсказка «Поверни телефон»
  }
}

// Для экранов игры: если на экран попали без нажатия (ссылка, перезагрузка) —
// включаем полный экран по первому касанию
export function useGameFullscreen() {
  const onPointerUp = () => requestGameFullscreen()

  onMounted(() => {
    if (isSupported()) window.addEventListener('pointerup', onPointerUp)
  })

  onBeforeUnmount(() => window.removeEventListener('pointerup', onPointerUp))
}
