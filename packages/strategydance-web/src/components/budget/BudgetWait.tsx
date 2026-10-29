import { type PropsWithChildren, useState } from 'react'

import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useBudgetExchangeRates from '~hooks/budget/useBudgetExchangeRates'
import useLocalDate from '~hooks/common/useLocalDate'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import Loading from '~components/common/Loading'

/*
  Holds the Budget page until its first reads land: the budget and the bills, started here at once
  so they fetch side by side, then the rates of their currencies, which only they name.
  `initialLoading` rather than `loading`, since the live queries write over the page while somebody
  is looking at it, and a new currency's rates load behind the table read before.

  It holds the page once only, once its reads have all landed: rates read later, as when the first bill in a currency arrives in an
  organization that converted nothing, load behind the page rather than unmount it, an open
  dialog's typing included, since an organization counting in euros alone has no table to keep.

  It keeps the team's live query open too, without waiting for it, as every page reading the
  organization's data does, since its pushes tell the app the reader was removed or the
  organization deleted
*/
function BudgetWait({ children }: PropsWithChildren) {
  const today = useLocalDate()
  const { initialLoading: isBudgetLoading, hasFailed: hasBudgetFailed } = useBudget()
  const { initialLoading: areBillsLoading, hasFailed: haveBillsFailed } = useBills()
  const { initialLoading: areRatesLoading, hasFailed: haveRatesFailed } = useBudgetExchangeRates(today)
  const [hasLoaded, setHasLoaded] = useState(false)

  useOrganizationTeam()

  const isLoading = isBudgetLoading || areBillsLoading || areRatesLoading
  const hasFailed = hasBudgetFailed || haveBillsFailed || haveRatesFailed

  // Set during render, once every first read has landed, never on a failure, whose retry the page
  // shows, as React takes a state read from what it rendered
  if (!isLoading && !hasFailed && !hasLoaded) setHasLoaded(true)

  if (isLoading && !hasLoaded) return <Loading source="BudgetWait" />

  return children
}

export default BudgetWait
