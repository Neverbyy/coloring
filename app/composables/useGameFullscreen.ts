// Полноэкранный режим игры на телефоне: прячет панель браузера и системные кнопки.
// На экране рисования (Android) ещё и фиксирует горизонтальную ориентацию. Браузер разрешает
// полный экран только в ответ на действие пользователя (нажатие). На iPhone Fullscreen API
// для страниц нет — там просто ничего не происходит

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>
}

interface FullscreenOptions {
  // Игрок сам начал игру (вход, нажатие на карточку): снова предлагаем полный экран,
  // даже если до этого он из него вышел
  explicit?: boolean
  // Зафиксировать горизонталь — только для экрана рисования
  lockLandscape?: boolean
}

let listening = false
let entered = false
let locked = false
// Игрок сам вышел из полноэкранного режима — не навязываем его до следующего явного действия
let exitedByUser = false
// Повторный requestFullscreen, пока первый не завершился, браузер отклоняет — переиспользуем
let pending: Promise<boolean> | null = null

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
  if (exitedByUser) return
  if (document.fullscreenElement && (locked || !options.lockLandscape)) return

  if (!(await enterFullscreen()) || !options.lockLandscape) return

  try {
    await (screen.orientation as LockableOrientation).lock?.('landscape')
    locked = true
  } catch {
    // Фиксация ориентации поддерживается не везде — играть можно и без неё
  }
}

// Для экранов игры: если на экран попали без нажатия (ссылка, перезагрузка) — включаем
// полный экран по первому касанию. При уходе с экрана снимаем фиксацию ориентации
export function useGameFullscreen(options: Pick<FullscreenOptions, 'lockLandscape'> = {}) {
  const onPointerUp = () => requestGameFullscreen(options)

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
