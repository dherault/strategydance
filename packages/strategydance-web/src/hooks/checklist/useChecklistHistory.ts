import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getChecklistHistoryRef } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  Every day a member ticked each of their checklist columns, read only once the table is unfolded
  past the week `useChecklist` holds. Keyed per member, so folding and unfolding again reads nothing
  new
*/
function useChecklistHistory(userId: string | null, isEnabled: boolean) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isError } = useQuery({
    queryKey: ['GetChecklistHistory', organizationId, userId],
    queryFn: async () => {
      const { data: history } = await executeQuery(
        getChecklistHistoryRef(dataConnect, { organizationId: organizationId!, userId: userId! }),
      )

      return history
    },
    enabled: Boolean(organizationId && userId && isEnabled),
  })

  return {
    data: data?.checklistItems ?? null,
    isLoading: Boolean(organizationId && userId && isEnabled) && isPending && !isError,
    hasFailed: isError,
  }
}

export default useChecklistHistory
