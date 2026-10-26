import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getBillsRef } from 'strategydance-database/web'

import type { Bill, DataSource } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import toBudgetBill from '~utils/budget/toBudgetBill'

import { dataConnect } from '~data/firebase'

const EMPTY_BILLS: Bill[] = []

/*
  The current organization's bills, every one not deleted, kept live: any member adding, saving or
  deleting a bill changes every open Budget page. Each row is read into strategydance-core's shape
  by `toBudgetBill`, keeping its payer and its receipt beside it.

  As `useTasks` does, the first read is an ordinary query, which `BudgetWait` waits on, and the
  subscription beside it writes what the server pushes into the same cache entry. A first read that
  fails is not an organization with no bill: `hasFailed` says so, and it does not retry on mount,
  for the reason `useOrganizationTeam` gives
*/
function useBills(): DataSource<Bill[]> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetBills', organizationId],
    queryFn: async () => {
      const { data: result } = await executeQuery(getBillsRef(dataConnect, { organizationId: organizationId! }))

      return result
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'bills',
    queryKey: organizationId ? ['GetBills', organizationId] : null,
    createQueryRef: () => getBillsRef(dataConnect, { organizationId: organizationId! }),
  })

  return {
    data: data ? data.bills.map(toBudgetBill) : EMPTY_BILLS,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useBills
