import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useBudgetExchangeRates from '~hooks/budget/useBudgetExchangeRates'
import useLocalDate from '~hooks/common/useLocalDate'

/*
  Whether the Budget page can be trusted: the budget, the bills and their rates are read apart, and
  any of them failing fails the page. A budget read as none would offer to set one over the real
  one, and rates read as none would leave every amount unconverted. Trying again reads again
  whichever failed
*/
function useBudgetReads() {
  const today = useLocalDate()
  const { loading: isBudgetLoading, refetch: refetchBudget, hasFailed: hasBudgetFailed } = useBudget()
  const { loading: areBillsLoading, refetch: refetchBills, hasFailed: haveBillsFailed } = useBills()
  const { loading: areRatesLoading, refetch: refetchRates, hasFailed: haveRatesFailed } = useBudgetExchangeRates(today)

  return {
    hasFailed: hasBudgetFailed || haveBillsFailed || haveRatesFailed,
    isRetrying: isBudgetLoading || areBillsLoading || areRatesLoading,
    retry: async () => {
      await Promise.all([
        hasBudgetFailed ? refetchBudget() : undefined,
        haveBillsFailed ? refetchBills() : undefined,
        haveRatesFailed ? refetchRates() : undefined,
      ])
    },
  }
}

export default useBudgetReads
