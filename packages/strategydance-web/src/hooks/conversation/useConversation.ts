import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { type GetConversationData, getConversationRef } from 'strategydance-database/web'

import type { Conversation, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import keepNewerRead from '~utils/common/keepNewerRead'
import isOlderConversation from '~utils/conversation/isOlderConversation'

import { dataConnect } from '~data/firebase'

/*
  One of the reader's conversations in the current organization, with the live tail of its thread,
  or null when there is none: deleted, somebody else's, in another organization, or a draft not
  stored yet. As `useConversations` does, the first read is an ordinary query, which
  `ConversationWait` waits on, and the subscription beside it writes each result the server pushes
  into the same cache entry. Whichever lands, a result older than the one cached leaves it alone:
  the SDK can deliver one late.

  The subscription keeps it current, so nothing marks it stale and a return to the tab does not
  read it again. A first read that fails is not a missing conversation: `hasFailed` says so, and it
  does not retry on mount, for the reason `useOrganizationTeam` gives
*/
function useConversation(conversationId: string): DataSource<Conversation | null> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)
  // The key names whose conversation it is: the tab's cache outlives a sign-out
  const queryKey = ['GetConversation', organizationId, conversationId, viewerId]

  function createQueryRef() {
    return getConversationRef(dataConnect, { organizationId: organizationId!, id: conversationId })
  }

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: result } = await executeQuery(createQueryRef())

      return result
    },
    enabled: isEnabled,
    structuralSharing: keepNewerRead<GetConversationData>((cached, next) =>
      isOlderConversation(cached.conversations[0], next.conversations[0]),
    ),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'conversation',
    queryKey: isEnabled ? queryKey : null,
    createQueryRef,
  })

  return {
    data: data?.conversations[0] ?? null,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useConversation
