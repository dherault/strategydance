import type { ExchangeRateTable } from 'strategydance-core'

// The latest ECB day among the rates read, which the budget dialog names, or null when none was
// read, as for an organization counting only in euros, which needs none
function getLatestExchangeRateDay(rates: ExchangeRateTable) {
  let latest: string | null = null

  for (const { days } of rates.values()) {
    const last = days.at(-1)

    if (last && (latest === null || last > latest)) latest = last
  }

  return latest
}

export default getLatestExchangeRateDay
