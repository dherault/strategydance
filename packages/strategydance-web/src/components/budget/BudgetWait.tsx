import type { PropsWithChildren } from 'react'

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

  It keeps the team's live query open too, without waiting for it, as every page reading the
  organization's data does, since its pushes tell the app the reader was removed or the
  organization deleted
*/
function BudgetWait({ children }: PropsWithChildren) {
  const today = useLocalDate()
  const { initialLoading: isBudgetLoading } = useBudget()
  const { initialLoading: areBillsLoading } = useBills()
  const { initialLoading: areRatesLoading } = useBudgetExchangeRates(today)

  useOrganizationTeam()

  if (isBudgetLoading || areBillsLoading || areRatesLoading) {
    return <Loading source="BudgetWait" />
  }

  return children
}

export default BudgetWait
