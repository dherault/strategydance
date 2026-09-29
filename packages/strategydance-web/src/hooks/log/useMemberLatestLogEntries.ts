import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getMemberLatestLogEntriesRef } from 'strategydance-database/web'

import type { DataSource, LogEntry } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_ENTRIES: LogEntry[] = []

/*
  One member's latest entries in the current organization's log, newest first, in the shape the
  log feed reads them, for the build in public page: the author its log cards show, and the reader,
  whose week the recap counts. Null while there is nobody to read.

  Picking another author keeps the last one's entries on screen until the new ones land, so the
  cards do not blink out: each entry names its author, which is who a card shows beside it. It does
  not retry on mount, and a failed read is `hasFailed` rather than an empty log: `BuildInPublicWait`
  waits on it
*/
function useMemberLatestLogEntries(userId: string | null): DataSource<LogEntry[]> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && userId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetMemberLatestLogEntries', organizationId, userId],
    queryFn: async () => {
      const { data: log } = await executeQuery(
        getMemberLatestLogEntriesRef(dataConnect, { organizationId: organizationId!, userId: userId! }),
      )

      return log.logEntries
    },
    enabled: isEnabled,
    placeholderData: keepPreviousData,
    retryOnMount: false,
  })

  return {
    data: data ?? EMPTY_ENTRIES,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useMemberLatestLogEntries
