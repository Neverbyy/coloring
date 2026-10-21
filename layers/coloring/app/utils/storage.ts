// localStorage может быть недоступен (приватный режим, запрет сайта) или переполнен:
// это не должно ломать игру — без него остаётся только сервер

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// false — не записалось
export function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Хранилище недоступно — удалять нечего
  }
}
