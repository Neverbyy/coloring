export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

const USERNAME_PATTERN = /^(?:(?!\p{DI})\p{L}(?:(?!\p{DI})[\p{L}\p{M}])*)?$/u

export function normalizeUsername(value: string): string {
  return value.trim().normalize('NFC')
}

export function usernameKey(value: string): string {
  return normalizeUsername(value).toLowerCase()
}

export function usernameCharsProblem(value: string): string | null {
  return USERNAME_PATTERN.test(normalizeUsername(value)) ? null : 'Имя может состоять только из букв'
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value)
  const chars = usernameCharsProblem(username)
  if (chars) return chars
  if (username.length < USERNAME_MIN_LENGTH) return `Имя — минимум ${USERNAME_MIN_LENGTH} символа`
  if (username.length > USERNAME_MAX_LENGTH) return `Имя — максимум ${USERNAME_MAX_LENGTH} символов`
  return null
}
