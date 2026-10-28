import { describe, expect, it } from 'bun:test'

import type { Currency } from '../enums'
import type { ExchangeRateYearRow } from '../types'

import { buildExchangeRateTable, convertMoney, findExchangeRate, listExchangeRateYears } from './exchangeRate'

function makeRow(currency: Currency, year: number, rates: Record<string, unknown>): ExchangeRateYearRow {
  return { currency, year, rates: JSON.stringify(rates) }
}

// Friday October 16 and Monday October 19, 2026, with the year's turn filed under each year
const table = buildExchangeRateTable([
  makeRow('USD', 2026, { '2026-10-19': 1.17, '2026-01-02': 1.04, '2026-10-16': 1.16 }),
  makeRow('USD', 2025, { '2025-12-31': 1.03 }),
  makeRow('USD', 1999, { '1999-01-04': 1.1789 }),
  makeRow('JPY', 2026, { '2026-10-16': 174, '2026-10-19': 175 }),
])

describe('buildExchangeRateTable', () => {
  it("sorts each currency's days across its years", () => {
    expect(table.get('USD')).toEqual({
      days: ['1999-01-04', '2025-12-31', '2026-01-02', '2026-10-16', '2026-10-19'],
      rates: [1.1789, 1.03, 1.04, 1.16, 1.17],
    })
  })

  it('leaves out what is not a rate, a row that is not an object, and the euro', () => {
    const odd = buildExchangeRateTable([
      makeRow('GBP', 2026, { '2026-10-16': 0.87, '2026-10-17': 0, '2026-10-18': -1, '2026-10-19': '0.88', later: 1 }),
      { currency: 'CHF', year: 2026, rates: 'not json' },
      { currency: 'SEK', year: 2026, rates: '[11.2]' },
      makeRow('NOK', 2026, {}),
      makeRow('EUR', 2026, { '2026-10-16': 2 }),
    ])

    expect([...odd.keys()]).toEqual(['GBP'])
    expect(odd.get('GBP')).toEqual({ days: ['2026-10-16'], rates: [0.87] })
  })
})

describe('findExchangeRate', () => {
  it("reads a Saturday at Friday's rate, and January 1 at December 31's", () => {
    expect(findExchangeRate(table, 'USD', '2026-10-17')).toBe(1.16)
    expect(findExchangeRate(table, 'USD', '2026-10-16')).toBe(1.16)
    expect(findExchangeRate(table, 'USD', '2026-10-19')).toBe(1.17)
    expect(findExchangeRate(table, 'USD', '2026-01-01')).toBe(1.03)
  })

  it('reads a day before the history at its first rate, and one after it at its latest', () => {
    expect(findExchangeRate(table, 'USD', '1998-06-01')).toBe(1.1789)
    expect(findExchangeRate(table, 'USD', '2027-03-01')).toBe(1.17)
  })

  it('reads the euro at 1, and a currency the table lacks as nothing', () => {
    expect(findExchangeRate(table, 'EUR', '2026-10-19')).toBe(1)
    expect(findExchangeRate(new Map(), 'EUR', '2026-10-19')).toBe(1)
    expect(findExchangeRate(table, 'GBP', '2026-10-19')).toBeNull()
  })
})

describe('convertMoney', () => {
  const round = buildExchangeRateTable([
    makeRow('USD', 2026, { '2026-10-19': 1.25 }),
    makeRow('JPY', 2026, { '2026-10-19': 160 }),
  ])

  it('converts dollars to whole yen, and yen to cents, through the euro', () => {
    expect(convertMoney(1000, 'USD', 'JPY', '2026-10-19', round)).toBe(1280)
    expect(convertMoney(1001, 'USD', 'JPY', '2026-10-19', round)).toBe(1281)
    expect(convertMoney(1000, 'JPY', 'USD', '2026-10-19', round)).toBe(781)
    expect(convertMoney(1500, 'JPY', 'USD', '2026-10-19', round)).toBe(1172)
  })

  it('rounds half away from zero', () => {
    expect(convertMoney(2, 'EUR', 'USD', '2026-10-19', round)).toBe(3)
    expect(convertMoney(-2, 'EUR', 'USD', '2026-10-19', round)).toBe(-3)
    expect(convertMoney(1, 'EUR', 'USD', '2026-10-19', round)).toBe(1)
  })

  it('converts each payment at its own day', () => {
    expect(convertMoney(10000, 'EUR', 'USD', '2026-01-01', table)).toBe(10300)
    expect(convertMoney(10000, 'EUR', 'USD', '2026-10-17', table)).toBe(11600)
    expect(convertMoney(11600, 'USD', 'EUR', '2026-10-17', table)).toBe(10000)
  })

  it('keeps an amount in its own currency, and converts nothing without a rate', () => {
    expect(convertMoney(31240, 'GBP', 'GBP', '2026-10-19', table)).toBe(31240)
    expect(convertMoney(31240, 'GBP', 'USD', '2026-10-19', table)).toBeNull()
    expect(convertMoney(31240, 'USD', 'GBP', '2026-10-19', table)).toBeNull()
  })
})

const YEARS_TODAY = '2026-10-19'

describe('listExchangeRateYears', () => {
  it('reads this year and last year with no bill', () => {
    expect(listExchangeRateYears([], YEARS_TODAY)).toEqual([2025, 2026])
  })

  it('adds the year of the last payment of each bill, once, in order', () => {
    expect(
      listExchangeRateYears(
        [
          { paidOn: '2021-06-01', recurrence: null, endsOn: null },
          { paidOn: '2019-03-02', recurrence: 'YEARLY', endsOn: '2022-12-31' },
          { paidOn: '2021-01-15', recurrence: null, endsOn: null },
        ],
        YEARS_TODAY,
      ),
    ).toEqual([2021, 2022, 2025, 2026])
  })

  it('reads a recurring bill at its latest payment, and a future one at its first', () => {
    expect(
      listExchangeRateYears(
        [
          { paidOn: '2018-02-10', recurrence: 'MONTHLY', endsOn: null },
          { paidOn: '2027-01-05', recurrence: null, endsOn: null },
        ],
        YEARS_TODAY,
      ),
    ).toEqual([2025, 2026, 2027])
  })
})
