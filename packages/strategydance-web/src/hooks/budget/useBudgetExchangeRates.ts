import { listExchangeRateYears } from 'strategydance-core'

import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useExchangeRates from '~hooks/budget/useExchangeRates'

/*
  The exchange rates the Budget page converts with on `today`: the budget's currency and every
  bill's, for the years `listExchangeRateYears` names. A new bill in another currency or year reads
  more, and the table read before stays meanwhile, as `useExchangeRates` keeps it.

  Nothing is read until the budget and the bills have landed: a read of the default currency before
  them would be the table kept while theirs loads, and `BudgetWait` would open the page on it. Nor
  after either failed, whose fallbacks name no currency of the organization's, so the page shows
  its failure without waiting on rates it cannot use
*/
function useBudgetExchangeRates(today: string) {
  const { data: settings, initialLoading: isBudgetLoading, hasFailed: hasBudgetFailed } = useBudget()
  const { data: bills, initialLoading: areBillsLoading, hasFailed: haveBillsFailed } = useBills()

  const isReady = !isBudgetLoading && !areBillsLoading && !hasBudgetFailed && !haveBillsFailed

  return useExchangeRates(
    isReady ? [settings.currency, ...bills.map(bill => bill.currency)] : [],
    isReady ? listExchangeRateYears(bills, today) : [],
  )
}

export default useBudgetExchangeRates
