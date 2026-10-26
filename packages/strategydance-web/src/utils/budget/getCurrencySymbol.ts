import type { Currency } from 'strategydance-core'

// A currency's narrow symbol in the reader's locale, "$" for any dollar, or its code for one that has
// none, as the currency picker shows it beside the name
function getCurrencySymbol(currency: Currency, locale: string) {
  return (
    new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find(part => part.type === 'currency')?.value ?? currency
  )
}

export default getCurrencySymbol
