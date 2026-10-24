import { CURRENCIES, MAX_MONEY_MINOR } from '../constants'
import { Currency } from '../enums'

// Digits, then optionally one point and digits: no sign, no grouping, no exponent, no space
const MONEY_PATTERN = /^(\d+)(?:\.(\d+))?$/

// Whether a value is one of the currencies a bill or a budget may be in
export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && Object.hasOwn(Currency, value)
}

/*
  The minor units a decimal string says, as "312.40" is 31240 cents, or null when it is not one: a
  sign, a thousands separator, an exponent or a space is refused rather than guessed at, and so is
  a digit past the currency's own, since "1500.5" yen names no amount anybody can pay. Zero is an
  amount, which the caller refuses where it needs one above it
*/
export function parseMoney(text: string, currency: Currency) {
  const match = MONEY_PATTERN.exec(text)

  if (!match) return null

  const { exponent } = CURRENCIES[currency]
  const fraction = match[2] ?? ''

  if (fraction.length > exponent) return null

  // Read as text first, so a value past the bound is refused before `Number` can round it below
  const digits = (match[1]! + fraction.padEnd(exponent, '0')).replace(/^0+(?=\d)/, '')

  if (digits.length > String(MAX_MONEY_MINOR).length) return null

  const minor = Number(digits)

  return minor > MAX_MONEY_MINOR ? null : minor
}

/*
  The decimal string minor units say, with the currency's digits, as 31240 cents is "312.40" and
  1500 yen "1500": what `parseMoney` reads back to the same number. A negative is written with its
  sign, as a budget's amount left can be. A fraction of a minor unit is a mistake upstream, and
  throws
*/
export function formatMoneyAmount(minor: number, currency: Currency) {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`${minor} is not a whole number of minor units`)

  const { exponent } = CURRENCIES[currency]
  const digits = String(Math.abs(minor)).padStart(exponent + 1, '0')
  const sign = minor < 0 ? '-' : ''

  if (exponent === 0) return sign + digits

  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`
}
