import { CURRENCIES, type Currency } from 'strategydance-core'
import { prettifyError, z } from 'zod'

import { EXCHANGE_RATES_REQUEST_TIMEOUT_MS, EXCHANGE_RATES_URL, OUTBOUND_USER_AGENT } from '~constants'

// Every currency the Budget takes but the euro, the rates' base, which is 1
const SYNCED_CURRENCIES = (Object.keys(CURRENCIES) as Currency[]).filter(currency => currency !== 'EUR')

/*
  A series as Frankfurter answers it: by ECB day, the units of each currency one euro bought. Any
  other base or amount refuses the answer whole, and so does a rate that is not a positive number,
  which zod's number, finite already, reads
*/
const answerSchema = z.object({
  amount: z.literal(1),
  base: z.literal('EUR'),
  rates: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.record(z.string(), z.number().positive())),
})

/*
  One year of the ECB's rates from Frankfurter, for every currency but the euro: the whole year, or,
  for the year under way, up to its latest day. Answers each currency's rates by day, that year's
  days alone: Frankfurter opens a series on the last ECB day on or before its first date, so a year's
  answer opens on the year before's last day, which that year's own answer holds. A currency the ECB
  published nothing for that year, as the króna in 2010, has no entry.

  Throws on a status outside 2xx, an answer it cannot read whole, or a request past 20 seconds, its
  answer read whole within them, so a year is never written from part of an answer. So does a past
  year with no day of its own, which the ECB published every year since 1999: the sync would move
  past it, and never fetch it again once a later year is stored
*/
async function requestExchangeRateYear(
  fetch: (url: string, init: RequestInit) => Promise<Response>,
  year: number,
  isUnderWay: boolean,
) {
  const range = `${year}-01-01..${isUnderWay ? '' : `${year}-12-31`}`
  const response = await fetch(`${EXCHANGE_RATES_URL}${range}?symbols=${SYNCED_CURRENCIES.join(',')}`, {
    headers: { accept: 'application/json', 'user-agent': OUTBOUND_USER_AGENT },
    signal: AbortSignal.timeout(EXCHANGE_RATES_REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`Frankfurter answered ${response.status} for the rates of ${year}`)

  const answer = answerSchema.safeParse(await response.json())

  if (!answer.success) {
    throw new Error(`Frankfurter's rates of ${year} are not ones this reads: ${prettifyError(answer.error)}`)
  }

  const ratesByCurrency = new Map<Currency, Record<string, number>>()

  for (const [day, rates] of Object.entries(answer.data.rates)) {
    if (!day.startsWith(`${year}-`)) continue

    for (const currency of SYNCED_CURRENCIES) {
      const rate = rates[currency]

      if (rate === undefined) continue

      const days = ratesByCurrency.get(currency) ?? {}

      days[day] = rate
      ratesByCurrency.set(currency, days)
    }
  }

  if (!isUnderWay && !ratesByCurrency.size) throw new Error(`Frankfurter answered no day of ${year}'s rates`)

  return ratesByCurrency
}

export default requestExchangeRateYear
