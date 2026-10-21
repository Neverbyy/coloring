// Проверка формы входа — одна для браузера (до отправки) и сервера. Текст ошибки или null
export function validateLogin(country: unknown, username: unknown): string | null {
  if (!isCountryCode(country)) return 'Выбери страну'
  if (typeof username !== 'string') return 'Придумай имя'
  return validateUsername(username)
}
