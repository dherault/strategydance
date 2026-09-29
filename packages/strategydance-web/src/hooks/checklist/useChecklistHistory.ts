import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getChecklistHistoryRef } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  Every day a member ticked each of their checklist columns, read only once the table is unfolded
  past the week `useChecklist` holds, or by the build in public page, which counts a month. Keyed
  per member, so folding and unfolding again reads nothing new.

  It does not retry on mount, since `BuildInPublicWait` waits on it, and a failed read is
  `hasFailed` until one succeeds
*/
function useChecklistHistory(userId: string | null, isEnabled: boolean) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetChecklistHistory', organizationId, userId],
    queryFn: async () => {
      const { data: history } = await executeQuery(
        getChecklistHistoryRef(dataConnect, { organizationId: organizationId!, userId: userId! }),
      )

      return history
    },
    enabled: Boolean(organizationId && userId && isEnabled),
    retryOnMount: false,
  })

  return {
    data: data?.checklistItems ?? null,
    isLoading: Boolean(organizationId && userId && isEnabled) && isPending && !isError,
    isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isError && data === undefined,
  }
}

export default useChecklistHistory
