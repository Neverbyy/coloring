export interface CountryOption {
  code: string
  name: string
}

export function useCountryOptions() {
  return useState<CountryOption[]>('country-options', () => {
    const names = new Intl.DisplayNames(['ru'], { type: 'region' })
    return COUNTRY_CODES
      .map(code => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  })
}

export function useCountryName() {
  const options = useCountryOptions()
  const names = computed(() => new Map(options.value.map(option => [option.code, option.name])))
  return (code: string) => names.value.get(code) ?? code
}

export function detectCountry(): string {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    try {
      const region = new Intl.Locale(language).maximize().region
      if (region && isCountryCode(region)) return region
    } catch {}
  }
  return ''
}
