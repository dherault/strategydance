import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { type GetOrganizationLogData, getOrganizationLogRef } from 'strategydance-database/web'

import type { DataSource } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_WEEK: GetOrganizationLogData = {
  logEntries: [],
  older: [],
}

type Week = {
  // The first and last day of the week, `YYYY-MM-DD`, both included
  from: string
  to: string
  // The newest week, the only one a new entry can land in, which is kept live
  isLive: boolean
}

/*
  A week of the current organization's log, and the day of the newest entry before it.

  The newest week is a live query: `GetOrganizationLog` refreshes on every mutation that adds,
  changes or hides an entry, and each pushed result replaces the cached one, so a teammate's entry
  lands without a reload. Older weeks are read once, since only an edit by their own author changes
  them, and the page reads them again after one.

  The newest week's days move at midnight, and the previous week stays on screen while the new one
  is read rather than the page waiting again. It does not retry on mount, and a failed read is
  `hasFailed` rather than a quiet week: `TodayWait` waits on the newest
*/
function useOrganizationLogWeek({
  from,
  to,
  isLive,
}: Week): DataSource<GetOrganizationLogData> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const queryKey = ['GetOrganizationLog', organizationId, from, to]

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: week } = await executeQuery(
        getOrganizationLogRef(dataConnect, { organizationId: organizationId!, from, to }),
      )

      return week
    },
    enabled: Boolean(organizationId),
    placeholderData: isLive ? keepPreviousData : undefined,
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'log',
    queryKey: organizationId && isLive ? queryKey : null,
    createQueryRef: () => getOrganizationLogRef(dataConnect, { organizationId: organizationId!, from, to }),
  })

  return {
    data: data ?? EMPTY_WEEK,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useOrganizationLogWeek
