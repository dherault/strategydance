import { useQuery } from '@tanstack/react-query'
import { QueryFetchPolicy } from 'firebase/data-connect'
import { getConversationToolOutputs } from 'strategydance-database/web'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import readConversationDeletedItem, {
  type ConversationDeletedItem,
} from '~utils/conversation/readConversationDeletedItem'

import { dataConnect } from '~data/firebase'

const NONE: ReadonlyMap<string, ConversationDeletedItem> = new Map()

// How many calls' outputs one read takes, `GetConversationToolOutputs`' limit
const OUTPUTS_LENGTH = 50

/*
  The documents and tasks a conversation's `delete_document` and `delete_task` calls deleted, by the
  call's message, and until when each can be restored, read from the calls' outputs together, 50 a
  read, which never change once a call succeeded: read again only when the rows are others. Empty
  until it is read, and when it could not be, when no row offers Restore
*/
function useConversationDeletedItems(conversationId: string, messageIds: string[]) {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null

  const { data } = useQuery({
    queryKey: ['GetConversationToolOutputs', organizationId, conversationId, messageIds, viewerId],
    queryFn: async () => {
      const batches = Array.from({ length: Math.ceil(messageIds.length / OUTPUTS_LENGTH) }, (_, index) =>
        messageIds.slice(index * OUTPUTS_LENGTH, (index + 1) * OUTPUTS_LENGTH),
      )
      const results = await Promise.all(
        batches.map(batch =>
          getConversationToolOutputs(
            dataConnect,
            { organizationId: organizationId!, id: conversationId, messageIds: batch },
            { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
          ),
        ),
      )
      const deleted = new Map<string, ConversationDeletedItem>()

      for (const { id, toolOutput } of results.flatMap(({ data }) => data.conversationMessages)) {
        const item = readConversationDeletedItem(toolOutput)

        if (item) deleted.set(id, item)
      }

      return deleted
    },
    enabled: Boolean(organizationId && viewerId && messageIds.length),
    staleTime: Number.POSITIVE_INFINITY,
    retryOnMount: false,
  })

  return data ?? NONE
}

export default useConversationDeletedItems
