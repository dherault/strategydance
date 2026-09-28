import { type Locale, SUPPORTED_LOCALES } from 'strategydance-core'

import { LOCALE_DISPLAY } from '~data/intl/constants'

// The options of a language select, each language behind its flag and named in itself
function getLocaleOptions(): { value: Locale, label: string }[] {
  return SUPPORTED_LOCALES.map(locale => ({
    value: locale,
    label: `${LOCALE_DISPLAY[locale].emoji} ${LOCALE_DISPLAY[locale].label}`,
  }))
}

export default getLocaleOptions
