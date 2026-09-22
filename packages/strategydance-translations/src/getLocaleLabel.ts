import type { Locale } from 'strategydance-core'

// Human-readable English name of a locale, used to disambiguate the code in prompts
export default function getLocaleLabel(locale: Locale) {
  const lowercaseLocale = locale.toLowerCase()

  return new Intl.DisplayNames(['en'], { type: 'language' }).of(lowercaseLocale) || lowercaseLocale
}
