import { type Currency, CURRENCIES, parseMoney } from 'strategydance-core'

/*
  What an amount typed in a field reads as: its minor units, or why it is none, which the field's
  error says. Read alike in every language, so the same text never means two amounts:

  - spaces are dropped, the no-break ones a French keyboard groups thousands with included
  - a lone comma is the decimal point, as a French, German or Spanish reader types it and as the
    decimal keypad of a phone in those countries offers it
  - a point and a comma together, two of either, or one followed by exactly three digits are
    thousands separators, which the field refuses rather than guess at: "1,500" is fifteen hundred
    in one country and one and a half in another
*/
type AmountInput =
  | { outcome: 'amount'; amountMinor: number }
  // Not a number, or nothing above 0
  | { outcome: 'invalid' }
  | { outcome: 'grouped' }
  // More decimals than the currency has
  | { outcome: 'decimals' }
  | { outcome: 'tooLarge' }

function readAmountInput(text: string, currency: Currency): AmountInput {
  const compact = text.replace(/\s/g, '')
  const separators = compact.match(/[.,]/g) ?? []
  const { exponent } = CURRENCIES[currency]

  if (separators.length > 1) return { outcome: 'grouped' }

  const amount = compact.replace(',', '.')
  const match = /^\d+(?:\.(\d+))?$/.exec(amount)

  if (!match) return { outcome: 'invalid' }

  const fraction = match[1] ?? ''

  if (fraction.length === 3 && exponent < 3) return { outcome: 'grouped' }
  if (fraction.length > exponent) return { outcome: 'decimals' }

  const amountMinor = parseMoney(amount, currency)

  if (amountMinor === null) return { outcome: 'tooLarge' }
  if (amountMinor <= 0) return { outcome: 'invalid' }

  return { outcome: 'amount', amountMinor }
}

// The budget catalogue's error for each way an amount is refused, which a form's field shows
const AMOUNT_INPUT_ERRORS = {
  invalid: 'amountInvalid',
  grouped: 'amountGrouped',
  decimals: 'amountDecimals',
  tooLarge: 'amountTooLarge',
} as const satisfies Record<Exclude<AmountInput['outcome'], 'amount'>, string>

// An amount's minor units, or null when the text reads as none
function readAmountMinor(text: string, currency: Currency) {
  const read = readAmountInput(text, currency)

  return read.outcome === 'amount' ? read.amountMinor : null
}

export { AMOUNT_INPUT_ERRORS, type AmountInput, readAmountMinor }

export default readAmountInput
