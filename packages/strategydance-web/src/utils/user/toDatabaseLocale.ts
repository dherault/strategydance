import type { Locale } from 'strategydance-core'
import { Locale as DatabaseLocale } from 'strategydance-database/web'

/*
  The two `Locale` enums carry the same values by construction, and `schema.test.ts` in
  strategydance-database is what keeps them that way. TypeScript still treats the generated one
  as nominal, so crossing between them is a lookup rather than an assignment
*/
function toDatabaseLocale(locale: Locale): DatabaseLocale {
  return DatabaseLocale[locale]
}

export default toDatabaseLocale
