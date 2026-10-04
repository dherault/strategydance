import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getConversationRunRef } from 'strategydance-database/web'

import type { ConversationRun, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  A conversation's latest run, or null before its first, kept live apart from the thread, so the
  progress lines and lease renewals a run writes wake this small read alone. Read as
  `useConversation` reads the conversation
*/
function useConversationRun(conversationId: string): DataSource<ConversationRun | null> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)
  const queryKey = ['GetConversationRun', organizationId, conversationId, viewerId]

  function createQueryRef() {
    return getConversationRunRef(dataConnect, { organizationId: organizationId!, conversationId })
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
    name: 'conversation run',
    queryKey: isEnabled ? queryKey : null,
    createQueryRef,
  })

  return {
    data: data?.conversationRuns[0] ?? null,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useConversationRun
