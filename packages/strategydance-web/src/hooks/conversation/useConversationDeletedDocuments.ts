import { useQuery } from '@tanstack/react-query'
import { QueryFetchPolicy } from 'firebase/data-connect'
import { getConversationToolOutputs } from 'strategydance-database/web'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import readConversationDeletedDocument, {
  type ConversationDeletedDocument,
} from '~utils/conversation/readConversationDeletedDocument'

import { dataConnect } from '~data/firebase'

const NONE: ReadonlyMap<string, ConversationDeletedDocument> = new Map()

/*
  The documents a conversation's `delete_document` calls deleted, by the call's message, and until
  when each can be restored, read from the calls' outputs in one read for all of them, which never
  change once a call succeeded: read again only when the rows are others. Empty until it is read,
  and when it could not be, when no row offers Restore
*/
function useConversationDeletedDocuments(conversationId: string, messageIds: string[]) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null

  const { data } = useQuery({
    queryKey: ['GetConversationToolOutputs', organizationId, conversationId, messageIds, viewerId],
    queryFn: async () => {
      const { data: result } = await getConversationToolOutputs(
        dataConnect,
        { organizationId: organizationId!, id: conversationId, messageIds },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )
      const deleted = new Map<string, ConversationDeletedDocument>()

      for (const { id, toolOutput } of result.conversationMessages) {
        const document = readConversationDeletedDocument(toolOutput)

        if (document) deleted.set(id, document)
      }

      return deleted
    },
    enabled: Boolean(organizationId && viewerId && messageIds.length),
    staleTime: Number.POSITIVE_INFINITY,
    retryOnMount: false,
  })

  return data ?? NONE
}

export default useConversationDeletedDocuments
