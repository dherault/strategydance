import type { Currency } from 'strategydance-core'
import {
  Currency as DatabaseCurrency,
  getExchangeRateYearKeys,
  upsertExchangeRateYear,
} from 'strategydance-database/backend'

import { EXCHANGE_RATES_FIRST_YEAR } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import requestExchangeRateYear, { SYNCED_CURRENCIES } from '~domain/budget/requestExchangeRateYear'

/*
  Keeps `ExchangeRateYear` current with the ECB's daily rates, as the worker's daily sweep asks: from
  the latest year stored, or 1999 while a currency it syncs has no row at all, as one added to the
  list since, to today's, one request to Frankfurter a year and one row a currency, written whole
  over what was there. A currency is backfilled once it has no row, never again: one the ECB stopped
  publishing keeps its rows and is not fetched back to 1999 every day. The first run backfills since 1999 in some 28
  requests and 800 writes, and a daily run makes one request and 29 writes.

  The latest year stored is always fetched again, and years go oldest first, so a year a run wrote
  partly, or before the ECB's last day of it, is finished by the next, and an older year is never
  fetched again once a later one is stored. A failed request or write throws, leaving the years
  after it for the next run. Today is the UTC date. Answers the years written and the latest day
*/
async function syncExchangeRates({
  fetch = globalThis.fetch,
  today = new Date().toISOString().slice(0, 10),
  currencies = SYNCED_CURRENCIES,
}: {
  fetch?: Parameters<typeof requestExchangeRateYear>[0]
  today?: string
  currencies?: readonly Currency[]
} = {}) {
  const { data } = await getExchangeRateYearKeys(dataConnect)
  const stored = new Set<string>(data.exchangeRateYears.map(({ currency }) => currency))
  const latestYear = data.exchangeRateYears[0]?.year
  const isMissingCurrency = currencies.some(currency => !stored.has(currency))
  const firstYear = latestYear === undefined || isMissingCurrency ? EXCHANGE_RATES_FIRST_YEAR : latestYear
  const currentYear = Number(today.slice(0, 4))
  const years: number[] = []
  let latestDay: string | null = null

  for (let year = firstYear; year <= currentYear; year++) {
    const ratesByCurrency = await requestExchangeRateYear(fetch, year, year === currentYear, currencies)

    for (const [currency, rates] of ratesByCurrency) {
      await upsertExchangeRateYear(dataConnect, {
        currency: DatabaseCurrency[currency],
        year,
        rates: JSON.stringify(rates),
      })

      for (const day of Object.keys(rates)) if (latestDay === null || day > latestDay) latestDay = day
    }

    if (ratesByCurrency.size) years.push(year)
  }

  logger.info(
    years.length
      ? `Synced exchange rates: wrote ${years.join(', ')}, up to ${latestDay}`
      : 'Synced exchange rates: nothing to write',
  )

  return { years, latestDay }
}

export default syncExchangeRates
