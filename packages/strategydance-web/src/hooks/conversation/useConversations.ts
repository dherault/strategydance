import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getConversationsRef } from 'strategydance-database/web'

import type { ConversationSummary, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_CONVERSATIONS: ConversationSummary[] = []

/*
  The reader's conversations in the current organization, latest activity first, kept live: as
  `useOrganizationTeam` does, the first read is an ordinary query, which `ConversationsWait` waits
  on, and the subscription beside it writes each list the server pushes into the same cache entry.

  A first read that fails is not an empty list: `hasFailed` says so, and it does not retry on
  mount, for the reason `useOrganizationTeam` gives
*/
function useConversations(): DataSource<ConversationSummary[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)
  // The key names whose conversations they are: the tab's cache outlives a sign-out
  const queryKey = ['GetConversations', organizationId, viewerId]

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: result } = await executeQuery(getConversationsRef(dataConnect, { organizationId: organizationId! }))

      return result
    },
    enabled: isEnabled,
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'conversations',
    queryKey: isEnabled ? queryKey : null,
    createQueryRef: () => getConversationsRef(dataConnect, { organizationId: organizationId! }),
  })

  return {
    data: data?.conversations ?? EMPTY_CONVERSATIONS,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useConversations
