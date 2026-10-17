import { useQuery } from '@tanstack/react-query'
import { QueryFetchPolicy } from 'firebase/data-connect'
import { getConversationSubagentReport } from 'strategydance-database/web'

import type { DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  A subagent's report, as its row's output shows it, read through the conversation that launched
  it, or null when it has none, or no such subagent is there to read. Read from the server each time
  the output opens, and dropped from the cache once it closes, as a call's output is
*/
function useConversationSubagentReport(
  conversationId: string,
  subagentId: string,
): DataSource<string | null> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetConversationSubagentReport', organizationId, conversationId, subagentId, viewerId],
    queryFn: async () => {
      const { data: result } = await getConversationSubagentReport(
        dataConnect,
        { organizationId: organizationId!, conversationId, subagentId },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )

      return result.conversations[0]?.report ?? null
    },
    enabled: isEnabled,
    gcTime: 0,
    retryOnMount: false,
  })

  return {
    data: data ?? null,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useConversationSubagentReport
