import { useQuery, useQueryClient } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { type GetTodayPreferencesData, getTodayPreferencesRef, updateTodayPreferences } from 'strategydance-database/web'

import type { DataSource, TodayPreferences } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import writeOptimistically from '~utils/common/writeOptimistically'

import { dataConnect } from '~data/firebase'

const EMPTY_PREFERENCES: TodayPreferences = {
  priorityOrder: [],
  hiddenPriorities: [],
}

/*
  How the reader's Today page lists the team's priorities in the current organization: the order
  they chose, and whom they hid. Theirs alone, read off their own membership.

  `update` writes to the cache first, so the page follows at once, and reads the view again if
  the server refuses. Saves for one organization are queued, so two quick ones land in order.

  It does not retry on mount, and a failed read is `hasFailed` rather than an empty view, as with
  the team: `TodayWait` waits on it
*/
function useTodayPreferences(): DataSource<TodayPreferences> & {
  hasFailed: boolean
  update: (preferences: TodayPreferences) => Promise<void>
} {
  const queryClient = useQueryClient()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const queryKey = ['GetTodayPreferences', organizationId]

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: preferences } = await executeQuery(getTodayPreferencesRef(dataConnect, { organizationId: organizationId! }))

      return preferences
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  async function update(preferences: TodayPreferences) {
    if (!organizationId) return

    await writeOptimistically({
      queryClient,
      queryKeys: [queryKey],
      rowKey: `todayPreferences:${organizationId}`,
      apply: () => queryClient.setQueryData<GetTodayPreferencesData>(queryKey, { userOrganization: preferences }),
      write: () => updateTodayPreferences(dataConnect, { organizationId, ...preferences }),
    })
  }

  return {
    data: data?.userOrganization ?? EMPTY_PREFERENCES,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
    update,
  }
}

export default useTodayPreferences
