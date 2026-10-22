const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const numberFormat = new Intl.NumberFormat('ru-RU')

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFormat.format(new Date(iso)) : '—'
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFormat.format(new Date(iso)) : '—'
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatShare(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '—'
}

const pluralRules = new Intl.PluralRules('ru-RU')

export function plural(count: number, forms: readonly [one: string, few: string, many: string]): string {
  const rule = pluralRules.select(count)
  return `${formatNumber(count)} ${rule === 'one' ? forms[0] : rule === 'few' ? forms[1] : forms[2]}`
}
