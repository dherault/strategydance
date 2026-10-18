import { useQuery } from '@tanstack/react-query'
import { QueryFetchPolicy } from 'firebase/data-connect'
import { getConversationSubagents } from 'strategydance-database/web'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  Whether a subagent is one of a conversation's, as the server says it now, or null until it has
  said, read while `isEnabled` alone, from the server whatever the caches hold: the live list a page
  holds can be one read before the subagent was launched, and the subscription that brings it anew
  can replay what the SDK cached first. A subagent's viewer asks it before it closes for a subagent
  the list lacks
*/
function useIsConversationSubagent(
  conversationId: string,
  subagentId: string | null,
  { isEnabled: isWanted }: { isEnabled: boolean },
): boolean | null {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(isWanted && subagentId && organizationId && viewerId)

  const { data } = useQuery({
    queryKey: ['IsConversationSubagent', organizationId, conversationId, subagentId, viewerId],
    queryFn: async () => {
      const { data: result } = await getConversationSubagents(
        dataConnect,
        { organizationId: organizationId!, conversationId },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )

      return result.conversations.some(({ id }) => id === subagentId)
    },
    enabled: isEnabled,
    gcTime: 0,
    retryOnMount: false,
  })

  return isEnabled ? (data ?? null) : null
}

export default useIsConversationSubagent
