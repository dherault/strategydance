import { useQuery, useQueryClient } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { type GetTodayPreferencesData, getTodayPreferencesRef, updateTodayPreferences } from 'strategydance-database/web'

import type { DataSource, TodayPreferences } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import runInOrder from '~utils/common/runInOrder'

import { dataConnect } from '~data/firebase'

const EMPTY_PREFERENCES: TodayPreferences = {
  priorityOrder: [],
  hiddenPriorities: [],
}

/*
  How the reader's Today page lists the team's priorities in the current organization: the order
  they chose, and whom they hid. Theirs alone, read off their own membership.

  `update` writes to the cache first, so the page follows at once, and puts the old value back if
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

    const previous = queryClient.getQueryData<GetTodayPreferencesData>(queryKey)

    queryClient.setQueryData<GetTodayPreferencesData>(queryKey, { userOrganization: preferences })

    try {
      await runInOrder(`todayPreferences:${organizationId}`, () => updateTodayPreferences(dataConnect, { organizationId, ...preferences }))
    }
    catch (error) {
      queryClient.setQueryData(queryKey, previous)

      throw error
    }
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
