import { CURRENCIES, type Currency } from 'strategydance-core'
import { prettifyError, z } from 'zod'

import { EXCHANGE_RATES_REQUEST_TIMEOUT_MS, EXCHANGE_RATES_URL, OUTBOUND_USER_AGENT } from '~constants'

// Every currency the Budget takes but the euro, the rates' base, which is 1
export const SYNCED_CURRENCIES = (Object.keys(CURRENCIES) as Currency[]).filter(currency => currency !== 'EUR')

// The last day a closed year's answer reaches at least: the ECB publishes a rate on every working
// day until the end of December, so an answer that stops before is one cut short
const LAST_DAY_OF_A_YEAR_AT_LEAST = '12-20'

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
  One year of the ECB's rates from Frankfurter, for every currency it publishes, kept to those given:
  the whole year, or, for the year under way, up to its latest day. Every currency rather than the
  ones given, so one the ECB stops publishing, as it stopped the rouble, the kuna and the lev, never
  fails the request for the others. Answers each currency's rates by day, that year's days alone:
  Frankfurter opens a series on the last ECB day on or before its first date, so a year's answer
  opens on the year before's last day, which that year's own answer holds. A currency the ECB
  published nothing for that year, as the króna in 2010, has no entry, which the sync writes as an
  empty row.

  Throws on a status outside 2xx, an answer it cannot read whole, or a request past 20 seconds, its
  answer read whole within them, so a year is never written from part of an answer. So does a past
  year with no day of its own, or whose days stop before December 20, which the ECB reached every
  year since 1999: the sync would move past it, and never fetch it again once a later year is stored
*/
async function requestExchangeRateYear(
  fetch: (url: string, init: RequestInit) => Promise<Response>,
  year: number,
  isUnderWay: boolean,
  currencies: readonly Currency[] = SYNCED_CURRENCIES,
) {
  const range = `${year}-01-01..${isUnderWay ? '' : `${year}-12-31`}`
  const response = await fetch(`${EXCHANGE_RATES_URL}${range}`, {
    headers: { accept: 'application/json', 'user-agent': OUTBOUND_USER_AGENT },
    signal: AbortSignal.timeout(EXCHANGE_RATES_REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`Frankfurter answered ${response.status} for the rates of ${year}`)

  const answer = answerSchema.safeParse(await response.json())

  if (!answer.success) {
    throw new Error(`Frankfurter's rates of ${year} are not ones this reads: ${prettifyError(answer.error)}`)
  }

  const ratesByCurrency = new Map<Currency, Record<string, number>>()
  let lastDay = ''

  for (const [day, rates] of Object.entries(answer.data.rates)) {
    if (!day.startsWith(`${year}-`)) continue
    if (day > lastDay) lastDay = day

    for (const currency of currencies) {
      const rate = rates[currency]

      if (rate === undefined) continue

      const days = ratesByCurrency.get(currency) ?? {}

      days[day] = rate
      ratesByCurrency.set(currency, days)
    }
  }

  if (!isUnderWay && !ratesByCurrency.size) throw new Error(`Frankfurter answered no day of ${year}'s rates`)

  if (!isUnderWay && lastDay < `${year}-${LAST_DAY_OF_A_YEAR_AT_LEAST}`) {
    throw new Error(`Frankfurter's rates of ${year} stop at ${lastDay}, short of its end`)
  }

  return ratesByCurrency
}

export default requestExchangeRateYear
