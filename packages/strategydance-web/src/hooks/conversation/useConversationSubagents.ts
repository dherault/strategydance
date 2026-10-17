import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getConversationSubagentsRef } from 'strategydance-database/web'

import type { ConversationSubagent, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const NO_SUBAGENTS: ConversationSubagent[] = []

/*
  The subagents a conversation launched, oldest first, each with its latest run and whether it
  reported, kept live, so its rows, the strip above its composer, its reconcile and Retry's question
  follow every run of theirs as it starts and ends. Read only while `isEnabled`, which a
  conversation that launched none never is, so its page subscribes to nothing more, and none while
  not read
*/
function useConversationSubagents(
  conversationId: string,
  { isEnabled: isWanted }: { isEnabled: boolean },
): DataSource<ConversationSubagent[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(isWanted && organizationId && viewerId)
  const queryKey = ['GetConversationSubagents', organizationId, conversationId, viewerId]

  function createQueryRef() {
    return getConversationSubagentsRef(dataConnect, { organizationId: organizationId!, conversationId })
  }

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: result } = await executeQuery(createQueryRef())

      return result
    },
    enabled: isEnabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'conversation subagents',
    queryKey: isEnabled ? queryKey : null,
    createQueryRef,
  })

  return {
    data: data?.conversations ?? NO_SUBAGENTS,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useConversationSubagents
