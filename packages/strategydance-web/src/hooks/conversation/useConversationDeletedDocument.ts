import { useQuery } from '@tanstack/react-query'
import { QueryFetchPolicy } from 'firebase/data-connect'
import { getConversationToolCall } from 'strategydance-database/web'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import readConversationDeletedDocument from '~utils/conversation/readConversationDeletedDocument'

import { dataConnect } from '~data/firebase'

/*
  The document a `delete_document` call deleted, and until when it can be restored, read once from
  the call's output, which never changes once the call succeeded. Null until it is read, when it
  could not be, and for an output that names no document
*/
function useConversationDeletedDocument(messageId: string) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null

  const { data } = useQuery({
    queryKey: ['GetConversationDeletedDocument', organizationId, messageId, viewerId],
    queryFn: async () => {
      const { data: result } = await getConversationToolCall(
        dataConnect,
        { organizationId: organizationId!, messageId },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )

      return readConversationDeletedDocument(result.conversationMessages[0]?.toolOutput)
    },
    enabled: Boolean(organizationId && viewerId),
    staleTime: Number.POSITIVE_INFINITY,
    retryOnMount: false,
  })

  return data ?? null
}

export default useConversationDeletedDocument
