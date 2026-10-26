import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useExchangeRates from '~hooks/budget/useExchangeRates'

import listExchangeRateYears from '~utils/budget/listExchangeRateYears'

/*
  The exchange rates the Budget page converts with on `today`: the budget's currency and every
  bill's, for the years `listExchangeRateYears` names. A new bill in another currency or year reads
  more, and the table read before stays meanwhile, as `useExchangeRates` keeps it
*/
function useBudgetExchangeRates(today: string) {
  const { data: settings } = useBudget()
  const { data: bills } = useBills()

  return useExchangeRates([settings.currency, ...bills.map(bill => bill.currency)], listExchangeRateYears(bills, today))
}

export default useBudgetExchangeRates
