// Ошибки $fetch: код ответа и текст, который сервер передал в createError({ message })

export function errorStatus(error: unknown): number | undefined {
  return (error as { statusCode?: number } | null)?.statusCode
}

export function errorMessage(error: unknown, fallback: string): string {
  const status = errorStatus(error)
  // Без ответа сервера (нет сети) или 5xx текст сервера ребёнку не поможет
  if (!status || status >= 500) return fallback
  const message = (error as { data?: { message?: unknown } }).data?.message
  return typeof message === 'string' && message ? message : fallback
}
