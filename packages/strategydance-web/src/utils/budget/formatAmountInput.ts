import { type Currency, CURRENCIES, formatMoneyAmount } from 'strategydance-core'

// The reader's decimal separator, as their language writes it: "," in French, "." in English
function readDecimalSeparator(locale: string) {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find(part => part.type === 'decimal')?.value ?? '.'
}

/*
  An amount in minor units as an amount field shows it, with the reader's decimal separator, which
  `readAmountInput` reads back, and no thousands separator, which it refuses: "45,00" in French,
  "45.00" in English, "1500" yen in both
*/
function formatAmountInput(amountMinor: number, currency: Currency, locale: string) {
  return formatMoneyAmount(amountMinor, currency).replace('.', readDecimalSeparator(locale))
}

// What an empty amount field shows of a currency's digits: "0" for yen, "0,00" in French
function formatAmountPlaceholder(currency: Currency, locale: string) {
  const { exponent } = CURRENCIES[currency]

  return exponent === 0 ? '0' : `0${readDecimalSeparator(locale)}${'0'.repeat(exponent)}`
}

export { formatAmountPlaceholder }

export default formatAmountInput
