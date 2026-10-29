import { summarizeBudget } from 'strategydance-core'

import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useBudgetExchangeRates from '~hooks/budget/useBudgetExchangeRates'
import useLocalDate from '~hooks/common/useLocalDate'

/*
  What the Budget page shows, computed by strategydance-core from the budget, the bills and their
  rates, on the browser's today, which `useLocalDate` checks every minute and on focus, so a page
  left open turns over at midnight.

  It answers the inputs beside the summary, so the panels that compute their own lists, the next
  30 days and the spending by company, count from the same bills, rates and today
*/
function useBudgetSummary() {
  const today = useLocalDate()
  const { data: settings } = useBudget()
  const { data: bills } = useBills()
  const { data: rates } = useBudgetExchangeRates(today)
  const { limit, currency } = settings

  return {
    summary: summarizeBudget({ bills, budget: limit, currency, today, rates }),
    bills,
    limit,
    currency,
    today,
    rates,
  }
}

export default useBudgetSummary
