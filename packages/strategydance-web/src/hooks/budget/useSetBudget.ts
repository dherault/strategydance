import { BudgetPeriod as DatabaseBudgetPeriod } from 'strategydance-database/web'
import { useSetBudget as useSetBudgetMutation } from 'strategydance-database/web/react'

import type { BudgetSettings } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import toDatabaseCurrency from '~utils/budget/toDatabaseCurrency'

import { dataConnect } from '~data/firebase'

/*
  Sets, changes or removes the current organization's budget, which only an administrator may.
  `SetBudget` is always sent every variable: the amount and the period together, or both null to
  remove the budget, the currency kept. The live `GetBudget` brings the change back to every page
*/
function useSetBudget() {
  const { organization } = useCurrentOrganization()
  const { mutateAsync, isPending } = useSetBudgetMutation(dataConnect)

  async function setBudget({ limit, currency }: BudgetSettings) {
    await mutateAsync({
      organizationId: organization!.id,
      currency: toDatabaseCurrency(currency),
      amountMinor: limit ? String(limit.amountMinor) : null,
      period: limit ? DatabaseBudgetPeriod[limit.period] : null,
    })
  }

  return { setBudget, isPending }
}

export default useSetBudget
