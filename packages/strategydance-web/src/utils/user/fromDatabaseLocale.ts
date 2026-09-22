import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from 'strategydance-core'
import type { Locale as DatabaseLocale } from 'strategydance-database/web'

/*
  The other direction of [toDatabaseLocale], and checked rather than cast: this value comes out
  of Postgres, where a column written by an older deployment can name a locale the app has
  since dropped. Falling back beats rendering the interface in nothing at all
*/
function fromDatabaseLocale(locale: DatabaseLocale): Locale {
  if (SUPPORTED_LOCALES.includes(locale as Locale)) return locale as Locale

  return DEFAULT_LOCALE
}

export default fromDatabaseLocale
