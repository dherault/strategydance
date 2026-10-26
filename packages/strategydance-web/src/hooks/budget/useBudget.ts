import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getBudgetRef } from 'strategydance-database/web'

import type { BudgetSettings, DataSource } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  The current organization's budget, kept live, so an administrator's change shows on every open
  page.

  An organization with no row has no budget and counts in US dollars, and one whose budget was
  removed keeps its currency with no limit. The amount, an `Int64String` in the SDK, becomes a
  number here.

  As `useTasks` does, the first read is an ordinary query, which `BudgetWait` waits on, and the
  subscription beside it writes what the server pushes into the same cache entry. A first read that
  fails is not "no budget": `hasFailed` says so, and it does not retry on mount, for the reason
  `useOrganizationTeam` gives
*/
function useBudget(): DataSource<BudgetSettings> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetBudget', organizationId],
    queryFn: async () => {
      const { data: result } = await executeQuery(getBudgetRef(dataConnect, { organizationId: organizationId! }))

      return result
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'budget',
    queryKey: organizationId ? ['GetBudget', organizationId] : null,
    createQueryRef: () => getBudgetRef(dataConnect, { organizationId: organizationId! }),
  })

  const row = data?.budgets[0]

  return {
    data: {
      limit:
        row?.amountMinor != null && row.period != null
          ? { amountMinor: Number(row.amountMinor), period: row.period }
          : null,
      currency: row?.currency ?? 'USD',
    },
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useBudget
