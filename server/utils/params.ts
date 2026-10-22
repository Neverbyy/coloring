import type { H3Event } from 'h3'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function userIdParam(event: H3Event, name = 'id'): string {
  const id = getRouterParam(event, name) ?? ''
  if (!isUuid(id)) throw createError({ statusCode: 404, message: 'Игрок не найден' })
  return id
}

export function pageQuery(event: H3Event): number {
  const page = Number.parseInt(String(getQuery(event).page ?? '1'), 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export function escapeLike(value: string): string {
  return value.replace(/[\%_]/g, '\$&')
}
