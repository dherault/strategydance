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
  the least advanced currency's latest year stored, or 1999 for one with no row at all, as one added
  to the list since, to today's, one request to Frankfurter a year and one row a currency, written
  whole over what was there. The first run backfills since 1999 in some 28 requests and 800 writes,
  and a daily run makes one request and 29 writes.

  Every currency gets its row for every year whose answer holds a day of its own, empty when the ECB
  published nothing of it that year, as the króna from 2009 to 2017, or since it stopped publishing
  one, as it stopped the rouble, the kuna and the lev. So a currency's latest year says how far it
  was fetched: a backfill a failure cut short carries on where it stopped, and a currency the ECB
  dropped moves on with empty rows rather than being fetched back every day.

  Each currency's latest year is always fetched again, and years go oldest first, so a year a run
  wrote partly, or before the ECB's last day of it, is finished by the next, and an older year is
  never fetched again once a later one is stored for every currency. A failed request or write
  throws, leaving the years after it for the next run. Today is the UTC date. Answers the years
  written and the latest day
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
  const latestYears = new Map<string, number>()

  for (const { currency, year } of data.exchangeRateYears) {
    latestYears.set(currency, Math.max(year, latestYears.get(currency) ?? year))
  }

  const firstYear = Math.min(...currencies.map(currency => latestYears.get(currency) ?? EXCHANGE_RATES_FIRST_YEAR))
  const currentYear = Number(today.slice(0, 4))
  const years: number[] = []
  let latestDay: string | null = null

  for (let year = firstYear; year <= currentYear; year++) {
    const ratesByCurrency = await requestExchangeRateYear(fetch, year, year === currentYear, currencies)

    // A year under way with no day of its own yet, as on January 1, writes nothing
    if (!ratesByCurrency.size) continue

    for (const currency of currencies) {
      const rates = ratesByCurrency.get(currency) ?? {}

      await upsertExchangeRateYear(dataConnect, {
        currency: DatabaseCurrency[currency],
        year,
        rates: JSON.stringify(rates),
      })

      for (const day of Object.keys(rates)) if (latestDay === null || day > latestDay) latestDay = day
    }

    years.push(year)
  }

  logger.info(
    years.length
      ? `Synced exchange rates: wrote ${years.join(', ')}, up to ${latestDay}`
      : 'Synced exchange rates: nothing to write',
  )

  return { years, latestDay }
}

export default syncExchangeRates
