import { useQuery } from '@tanstack/react-query'
import { QueryFetchPolicy } from 'firebase/data-connect'
import { getConversationToolCall } from 'strategydance-database/web'

import type { ConversationToolCall, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  A tool call's input and output, as its dialog shows them, or null when there is no such call to
  read. Read from the server each time the dialog opens, since a call's output arrives after its
  message, and dropped from the cache once the dialog closes
*/
function useConversationToolCall(messageId: string): DataSource<ConversationToolCall | null> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetConversationToolCall', organizationId, messageId, viewerId],
    queryFn: async () => {
      const { data: result } = await getConversationToolCall(
        dataConnect,
        { organizationId: organizationId!, messageId },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )

      return result.conversationMessages[0] ?? null
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

export default useConversationToolCall
