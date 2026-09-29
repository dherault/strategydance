import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getActivityDaysRef } from 'strategydance-database/web'

import type { DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_DATES: string[] = []

/*
  The days the reader was active in the current organization, `YYYY-MM-DD`, newest first, which
  their streak is counted from: see `ActivityDay`. Read again whenever the page opens, since the
  Today page marks the days and nothing pushes them.

  It does not retry on mount, and a failed read is `hasFailed` rather than no streak:
  `BuildInPublicWait` waits on it
*/
function useActivityDays(): DataSource<string[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    // The key names whose days they are: the tab's cache outlives a sign-out
    queryKey: ['GetActivityDays', organizationId, viewerId],
    queryFn: async () => {
      const { data: activity } = await executeQuery(
        getActivityDaysRef(dataConnect, { organizationId: organizationId! }),
      )

      return activity.activityDays.map(activityDay => activityDay.date)
    },
    enabled: isEnabled,
    retryOnMount: false,
  })

  return {
    data: data ?? EMPTY_DATES,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useActivityDays
