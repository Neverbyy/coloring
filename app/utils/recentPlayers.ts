import { isCountryCode } from '#shared/utils/countries'
import { usernameKey, validateUsername } from '#shared/utils/username'

export const RECENT_PLAYERS_LIMIT = 4

const DAY_MS = 24 * 60 * 60 * 1000

export interface RecentPlayer {
  username: string
  country: string
  seenAt?: number
}

function isRecentPlayer(value: unknown): value is RecentPlayer {
  if (!value || typeof value !== 'object') return false
  const { username, country } = value as Record<string, unknown>
  return isCountryCode(country) && typeof username === 'string' && validateUsername(username) === null
}

function validSeenAt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100
  const units = count % 10
  if (units === 1 && tens !== 11) return one
  if (units >= 2 && units <= 4 && (tens < 12 || tens > 14)) return few
  return many
}

function startOfDay(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function seenAgo(seenAt: number, now: number): string {
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(seenAt)) / DAY_MS))
  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? 'неделю назад' : `${weeks} ${plural(weeks, 'неделю', 'недели', 'недель')} назад`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return months === 1 ? 'месяц назад' : `${months} ${plural(months, 'месяц', 'месяца', 'месяцев')} назад`
  }
  return 'больше года назад'
}

export function parseRecentPlayers(value: unknown): RecentPlayer[] {
  if (!Array.isArray(value)) return []
  const players: RecentPlayer[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (players.length === RECENT_PLAYERS_LIMIT) break
    if (!isRecentPlayer(item)) continue
    const key = usernameKey(item.username)
    if (seen.has(key)) continue
    seen.add(key)
    const seenAt = validSeenAt(item.seenAt)
    players.push(seenAt ? { username: item.username, country: item.country, seenAt } : { username: item.username, country: item.country })
  }
  return players
}

export function rememberPlayer(players: RecentPlayer[], player: RecentPlayer): RecentPlayer[] {
  return parseRecentPlayers([player, ...forgetPlayer(players, player.username)])
}

export function forgetPlayer(players: RecentPlayer[], username: string): RecentPlayer[] {
  const key = usernameKey(username)
  return players.filter(player => usernameKey(player.username) !== key)
}
