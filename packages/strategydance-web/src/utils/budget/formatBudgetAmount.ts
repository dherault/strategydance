import { CURRENCIES, type Currency } from 'strategydance-core'

/*
  An amount in minor units, written in the reader's locale with its currency's sign: in whole
  units, as the page's sums are, or `exact`, to the currency's own digits, as a bill's amount is.
  The digits come from `CURRENCIES` rather than `Intl`, whose digits differ between runtimes
*/
function formatBudgetAmount(minor: number, currency: Currency, locale: string, { exact = false } = {}) {
  const { exponent } = CURRENCIES[currency]
  const digits = exact ? exponent : 0

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 10 ** exponent)
}

export default formatBudgetAmount
