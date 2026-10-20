export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]+$/u

export function normalizeUsername(value: string): string {
  // NFC: «й» из двух символов и из одного — одно и то же имя
  return value.trim().normalize('NFC')
}

// Ключ уникальности: имя без учёта регистра («Masha» и «masha» — один игрок)
export function usernameKey(value: string): string {
  return normalizeUsername(value).toLowerCase()
}

// Возвращает текст ошибки или null, если имя подходит
export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value)
  if (username.length < USERNAME_MIN_LENGTH) return `Имя — минимум ${USERNAME_MIN_LENGTH} символа`
  if (username.length > USERNAME_MAX_LENGTH) return `Имя — максимум ${USERNAME_MAX_LENGTH} символов`
  if (!USERNAME_PATTERN.test(username)) return 'Только буквы, цифры и знаки _ . -'
  return null
}
