export function flagUrl(code: string): string {
  return `/flags/${code.toLowerCase()}.svg`
}
