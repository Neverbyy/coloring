export interface CountryOption {
  code: string
  name: string
}

// Список строится на сервере и уходит в payload: названия из ICU в Node и браузере
// могут отличаться, а так гидратация не расходится
export function useCountryOptions() {
  return useState<CountryOption[]>('country-options', () => {
    const names = new Intl.DisplayNames(['ru'], { type: 'region' })
    return COUNTRY_CODES
      .map(code => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  })
}

export function detectCountry(): string {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    try {
      const region = new Intl.Locale(language).maximize().region
      if (region && isCountryCode(region)) return region
    } catch {
      // некорректный тег языка — пробуем следующий
    }
  }
  return ''
}
