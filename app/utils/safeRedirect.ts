// Куда попадает игрок после входа, если не просил другого
export const HOME_PATH = '/coloring'

// Куда вернуть после входа. Только пути внутри сайта: «//evil.com» — уже другой домен
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return HOME_PATH
  }
  return value
}
