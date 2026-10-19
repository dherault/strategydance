import type { IntlShape } from 'react-intl'

// A daily spend ceiling, in microdollars, as a sentence says it: whole US dollars, "$25"
function formatSpendCeiling({ formatNumber }: IntlShape, microdollars: number) {
  return formatNumber(microdollars / 1_000_000, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default formatSpendCeiling
