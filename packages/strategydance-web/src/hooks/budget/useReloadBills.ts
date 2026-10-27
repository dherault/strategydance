import { useQueryClient } from '@tanstack/react-query'
import { QueryFetchPolicy } from 'firebase/data-connect'
import { getBills } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import toBudgetBill from '~utils/budget/toBudgetBill'

import { dataConnect } from '~data/firebase'

/*
  Reads the organization's bills again as the server has them, past the SDK's own cache, which
  answers a read first by default, and writes them where `useBills` reads, so the page shows a
  write as soon as it lands rather than once the live query pushes it. What a refused save reads
  to tell why it was refused
*/
function useReloadBills() {
  const queryClient = useQueryClient()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  return async function reloadBills() {
    if (!organizationId) return []

    const { data } = await getBills(dataConnect, { organizationId }, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })

    queryClient.setQueryData(['GetBills', organizationId], data)

    return data.bills.map(toBudgetBill)
  }
}

export default useReloadBills
