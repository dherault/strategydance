import { buildExchangeRateTable, type Currency } from 'strategydance-core'
import { Currency as DatabaseCurrency, getExchangeRatesForAgent } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

/*
  The ECB's rates the Budget module converts with, for the currencies its bills come in and the years
  their payments fall in, into `currency`, the budget's. Nothing is read when every amount is in that
  currency already, since nothing converts. `ratesDate` is the latest ECB day among the rows read, the
  rates' date the module names, null when it read none
*/
async function readBudgetRates(currencies: readonly Currency[], years: readonly number[], currency: Currency) {
  const converted = [...new Set([...currencies, currency])].filter(other => other !== 'EUR')

  if (currencies.every(other => other === currency)) {
    return { rates: buildExchangeRateTable([]), ratesDate: null }
  }

  const { data } = await getExchangeRatesForAgent(dataConnect, {
    currencies: converted.map(other => DatabaseCurrency[other]),
    years: [...new Set(years)],
  })
  const rates = buildExchangeRateTable(data.exchangeRateYears)
  let ratesDate: string | null = null

  for (const { days } of rates.values()) {
    const last = days.at(-1)

    if (last && (!ratesDate || last > ratesDate)) ratesDate = last
  }

  return { rates, ratesDate }
}

export default readBudgetRates
