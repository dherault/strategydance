import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getLatestLogEntriesRef } from 'strategydance-database/web'

import type { DataSource, LogEntry } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_ENTRIES: LogEntry[] = []

/*
  Each member's latest entries in the current organization's log, as one list, newest first, in
  the shape the log feed reads them, for the build in public page, whose cards pick from one
  author's own. Read again whenever the page opens, since the Today page writes the log.

  It does not retry on mount, and a failed read is `hasFailed` rather than an empty log:
  `BuildInPublicWait` waits on it
*/
function useLatestLogEntries(): DataSource<LogEntry[]> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetLatestLogEntries', organizationId],
    queryFn: async () => {
      const { data: log } = await executeQuery(getLatestLogEntriesRef(dataConnect, { organizationId: organizationId! }))

      return log.userOrganizations
        .flatMap(({ user }) => user.logEntries.map(entry => ({ ...entry, user: { id: user.id } })))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  return {
    data: data ?? EMPTY_ENTRIES,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useLatestLogEntries
