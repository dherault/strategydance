import type { Currency } from 'strategydance-core'
import { Currency as DatabaseCurrency } from 'strategydance-database/web'

/*
  The two `Currency` enums carry the same values by construction, and `schema.test.ts` in
  strategydance-database is what keeps them that way. TypeScript still treats the generated one
  as nominal, so crossing between them is a lookup rather than an assignment
*/
function toDatabaseCurrency(currency: Currency): DatabaseCurrency {
  return DatabaseCurrency[currency]
}

export default toDatabaseCurrency
