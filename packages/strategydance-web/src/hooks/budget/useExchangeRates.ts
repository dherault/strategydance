import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { buildExchangeRateTable, type Currency, type ExchangeRateTable } from 'strategydance-core'
import { getExchangeRatesRef } from 'strategydance-database/web'

import type { DataSource } from '~types'

import toDatabaseCurrency from '~utils/budget/toDatabaseCurrency'

import { dataConnect } from '~data/firebase'

// How long a read of the rates is kept before a return to the tab reads them again
const RATES_STALE_MS = 60 * 60 * 1000

/*
  The ECB's daily rates of the currencies and years given, as the Budget's computations read them:
  the budget's currency and every bill's, for each year the page computes. Read rather than kept
  live, since the worker writes them once a day, and read again as the page opens or the tab comes
  back into focus, once the read is an hour old. The euro needs no rate, and lists left without a currency or a year read nothing.

  While other lists load, as when a bill brings a currency or a year the page did not read, the
  table read last stays, so a waiter above the page keeps it mounted: the computations name the
  currency in `missingRates` meanwhile, as they name one with no row for a year it needs
*/
function useExchangeRates(
  currencies: readonly Currency[],
  years: readonly number[],
): DataSource<ExchangeRateTable> & { hasFailed: boolean } {
  // Deduplicated and sorted, so the same lists in another order read the same cache
  const currenciesRead = [...new Set(currencies)].filter(currency => currency !== 'EUR').sort()
  const yearsRead = [...new Set(years)].sort((a, b) => a - b)
  const isEnabled = currenciesRead.length > 0 && yearsRead.length > 0

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetExchangeRates', currenciesRead, yearsRead],
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getExchangeRatesRef(dataConnect, { currencies: currenciesRead.map(toDatabaseCurrency), years: yearsRead }),
      )

      return result
    },
    enabled: isEnabled,
    placeholderData: keepPreviousData,
    retryOnMount: false,
    // The worker writes them once a day, so an hour's old read is as good, and a reader moving
    // between tabs does not read some hundred rows again on each return
    staleTime: RATES_STALE_MS,
    // Kept as long once the page goes, or a return after five minutes would read them again
    gcTime: RATES_STALE_MS,
  })

  return {
    data: buildExchangeRateTable(data?.exchangeRateYears ?? []),
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useExchangeRates
