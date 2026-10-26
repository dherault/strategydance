import { CURRENCIES, type Currency } from 'strategydance-core'

// An amount in minor units, short, as "$2.5K": the chart's ticks and its budget's label
function formatCompactBudgetAmount(minor: number, currency: Currency, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(minor / 10 ** CURRENCIES[currency].exponent)
}

export default formatCompactBudgetAmount
