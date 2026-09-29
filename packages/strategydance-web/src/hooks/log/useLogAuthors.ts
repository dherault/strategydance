import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getLogAuthorsRef } from 'strategydance-database/web'

import type { DataSource } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_AUTHOR_IDS: string[] = []

/*
  The ids of the current organization's members who have written in its log, for the build in
  public page's picker of whose log its cards show. Their entries are read one author at a time,
  by `useMemberLatestLogEntries`.

  It does not retry on mount, and a failed read is `hasFailed` rather than nobody:
  `BuildInPublicWait` waits on it
*/
function useLogAuthors(): DataSource<string[]> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetLogAuthors', organizationId],
    queryFn: async () => {
      const { data: authors } = await executeQuery(getLogAuthorsRef(dataConnect, { organizationId: organizationId! }))

      return authors.userOrganizations.map(({ user }) => user.id)
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  return {
    data: data ?? EMPTY_AUTHOR_IDS,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useLogAuthors
