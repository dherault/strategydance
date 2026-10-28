import { CURRENCIES } from '../constants'
import type { Currency } from '../enums'
import type { BillSchedule, ExchangeRateTable, ExchangeRateYearRow } from '../types'

import { getLastBillPayment } from './bill'
import { compareDays } from './calendarDay'

const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/*
  Each currency's days and rates, sorted by day, from the rows the page or the module read. The
  rates are the ECB's, units of the currency to one euro, so the euro has no row: it is 1. A day
  whose rate is not a positive number is left out rather than allowed to turn every sum it reaches
  into NaN, and so is a row whose text is not an object
*/
export function buildExchangeRateTable(rows: readonly ExchangeRateYearRow[]): ExchangeRateTable {
  const entriesByCurrency = new Map<Currency, [string, number][]>()

  for (const row of rows) {
    if (row.currency === 'EUR') continue

    let rates: unknown

    try {
      rates = JSON.parse(row.rates)
    } catch {
      continue
    }

    if (typeof rates !== 'object' || rates === null || Array.isArray(rates)) continue

    const entries = entriesByCurrency.get(row.currency) ?? []

    for (const [day, rate] of Object.entries(rates)) {
      if (CALENDAR_DAY_PATTERN.test(day) && typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        entries.push([day, rate])
      }
    }

    entriesByCurrency.set(row.currency, entries)
  }

  const table = new Map<Currency, { days: string[]; rates: number[] }>()

  for (const [currency, entries] of entriesByCurrency) {
    if (!entries.length) continue

    entries.sort(([a], [b]) => compareDays(a, b))
    table.set(currency, { days: entries.map(([day]) => day), rates: entries.map(([, rate]) => rate) })
  }

  return table
}

/*
  The units of a currency one euro bought on a day: the rate of the last ECB day on or before it,
  since the ECB publishes none on a weekend or a holiday. A day before the history is read at its
  first rate, and a day after it, a payment still to come, at its latest. 1 for the euro, and null
  for a currency the table lacks, which nothing should then be converted from or to
*/
export function findExchangeRate(table: ExchangeRateTable, currency: Currency, day: string) {
  if (currency === 'EUR') return 1

  const history = table.get(currency)

  if (!history?.days.length) return null

  // The first index whose day is after the one asked for
  let low = 0
  let high = history.days.length

  while (low < high) {
    const middle = (low + high) >>> 1

    if (history.days[middle]! <= day) low = middle + 1
    else high = middle
  }

  return history.rates[Math.max(0, low - 1)]!
}

/*
  An amount in minor units of one currency, in minor units of another, through the euro at each
  currency's rate on the day, rounded half away from zero, or null when either currency has no rate.
  Each payment converts at its own day's rate, so a subscription paid for years follows the rate
  rather than keep its first payment's
*/
export function convertMoney(amountMinor: number, from: Currency, to: Currency, day: string, table: ExchangeRateTable) {
  if (from === to) return amountMinor

  const fromRate = findExchangeRate(table, from, day)
  const toRate = findExchangeRate(table, to, day)

  if (fromRate === null || toRate === null) return null

  const value = ((amountMinor * toRate) / fromRate) * 10 ** (CURRENCIES[to].exponent - CURRENCIES[from].exponent)

  return value < 0 ? -Math.round(-value) || 0 : Math.round(value)
}

/*
  The years whose exchange rates the Budget page and the module read: this year and last year,
  which the page's stats, chart and panels count, and the year of each bill's last payment, at
  whose rate a bill is converted. A payment after the rates stored converts at the latest, so next
  year, which December's "next month" reaches into, needs none of its own
*/
export function listExchangeRateYears(bills: readonly BillSchedule[], today: string) {
  const year = Number(today.slice(0, 4))
  const years = new Set([year - 1, year])

  for (const bill of bills) years.add(Number(getLastBillPayment(bill, today).slice(0, 4)))

  return [...years].sort((a, b) => a - b)
}
