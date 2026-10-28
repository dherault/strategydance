import { describe, expect, it } from 'bun:test'

import { CURRENCIES, MAX_MONEY_MINOR } from '../constants'
import { Currency } from '../enums'

import { formatMoneyAmount, isCurrency, parseMoney } from './money'

describe('CURRENCIES', () => {
  it('gives every currency an exponent, none for the yen, the won and the króna', () => {
    expect(Object.keys(CURRENCIES)).toEqual(Object.values(Currency))
    expect(
      Object.entries(CURRENCIES)
        .filter(([, { exponent }]) => exponent === 0)
        .map(([currency]) => currency),
    ).toEqual(['ISK', 'JPY', 'KRW'])
  })
})

describe('isCurrency', () => {
  it('takes the currencies the ECB publishes and nothing else', () => {
    expect(isCurrency('USD')).toBe(true)
    expect(isCurrency('EUR')).toBe(true)
    expect(isCurrency('BGN')).toBe(false)
    expect(isCurrency('usd')).toBe(false)
    expect(isCurrency('toString')).toBe(false)
    expect(isCurrency(null)).toBe(false)
  })
})

describe('parseMoney', () => {
  it('reads a decimal string into minor units', () => {
    expect(parseMoney('312.40', 'USD')).toBe(31240)
    expect(parseMoney('312.4', 'USD')).toBe(31240)
    expect(parseMoney('312', 'USD')).toBe(31200)
    expect(parseMoney('0.05', 'USD')).toBe(5)
    expect(parseMoney('0', 'USD')).toBe(0)
    expect(parseMoney('007.50', 'USD')).toBe(750)
    expect(parseMoney('1500', 'JPY')).toBe(1500)
  })

  it('refuses more decimals than the currency has', () => {
    expect(parseMoney('1500.5', 'JPY')).toBeNull()
    expect(parseMoney('1500.0', 'JPY')).toBeNull()
    expect(parseMoney('12.345', 'USD')).toBeNull()
  })

  it('refuses anything but digits and one point between digits', () => {
    for (const text of ['1,500', '-3', '1e3', ' 12', '12 ', '12.', '.5', '', '1.2.3', '$12', '١٢']) {
      expect(parseMoney(text, 'USD')).toBeNull()
    }
  })

  it('refuses a value past MAX_MONEY_MINOR, however many digits it takes', () => {
    expect(parseMoney(String(MAX_MONEY_MINOR), 'JPY')).toBe(MAX_MONEY_MINOR)
    expect(parseMoney(String(MAX_MONEY_MINOR + 1), 'JPY')).toBeNull()
    expect(parseMoney('10000000000000.00', 'USD')).toBe(MAX_MONEY_MINOR)
    expect(parseMoney('10000000000000.01', 'USD')).toBeNull()
    expect(parseMoney('99999999999999999999999', 'JPY')).toBeNull()
    expect(parseMoney(`000000${MAX_MONEY_MINOR}`, 'JPY')).toBe(MAX_MONEY_MINOR)
  })
})

describe('formatMoneyAmount', () => {
  it("writes minor units with the currency's digits", () => {
    expect(formatMoneyAmount(31240, 'USD')).toBe('312.40')
    expect(formatMoneyAmount(5, 'USD')).toBe('0.05')
    expect(formatMoneyAmount(0, 'USD')).toBe('0.00')
    expect(formatMoneyAmount(1500, 'JPY')).toBe('1500')
    expect(formatMoneyAmount(-1250, 'EUR')).toBe('-12.50')
    expect(formatMoneyAmount(MAX_MONEY_MINOR, 'USD')).toBe('10000000000000.00')
  })

  it('writes a sum past 2^53 whole, as a year of a large weekly bill comes to', () => {
    expect(formatMoneyAmount(52 * MAX_MONEY_MINOR, 'USD')).toBe('520000000000000.00')
    expect(formatMoneyAmount(1.6e22, 'IDR')).toBe('160000000000000000000.00')
    expect(formatMoneyAmount(-52 * MAX_MONEY_MINOR, 'JPY')).toBe('-52000000000000000')
  })

  it('throws on a fraction of a minor unit', () => {
    expect(() => formatMoneyAmount(12.5, 'USD')).toThrow(RangeError)
    expect(() => formatMoneyAmount(Number.NaN, 'USD')).toThrow(RangeError)
  })

  it('reads back through parseMoney to the same amount', () => {
    for (const currency of ['USD', 'JPY', 'ISK', 'EUR'] as const) {
      for (const minor of [0, 1, 9, 10, 99, 100, 31240, 1500, MAX_MONEY_MINOR]) {
        expect(parseMoney(formatMoneyAmount(minor, currency), currency)).toBe(minor)
      }
    }
  })
})
