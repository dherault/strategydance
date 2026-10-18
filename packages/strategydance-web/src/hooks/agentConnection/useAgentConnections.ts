import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { type GetAgentConnectionsData, getAgentConnectionsRef } from 'strategydance-database/web'

import type { AgentConnection, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'

import { dataConnect } from '~data/firebase'

const EMPTY_CONNECTIONS: AgentConnection[] = []

/*
  The external agents the reader connected, across their organizations, newest first, kept live.

  The first read is an ordinary query, which is what `AgentConnectionsWait` waits on, and the
  subscription beside it writes each result the server pushes into the same cache entry:
  `GetAgentConnections` is refreshed by Allow on the consent page, by Disconnect, and by the
  reader's removal from an organization or its deletion. A revocation the agent makes itself, or a
  code it presented twice, names no member, so the tab shows it on its next read, as the page
  regains focus. `useQuery` is called directly rather than through the generated hook, as
  `useOrganizationTeam` explains.

  A first read that fails is not an empty list: `hasFailed` says so. It does not retry on mount, since with
  nothing cached a retry resets the query to pending, the waiter unmounts the tab, and the tab's
  return would retry again, forever
*/
function useAgentConnections(): DataSource<AgentConnection[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()

  const viewerId = viewer?.uid ?? null
  const isEnabled = Boolean(viewerId)

  const { data, isPending, isFetching, isError, refetch } = useQuery<GetAgentConnectionsData>({
    queryKey: ['GetAgentConnections', viewerId],
    queryFn: async () => {
      const { data: connections } = await executeQuery(getAgentConnectionsRef(dataConnect))

      return connections
    },
    enabled: isEnabled,
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'agent connections',
    queryKey: isEnabled ? ['GetAgentConnections', viewerId] : null,
    createQueryRef: () => getAgentConnectionsRef(dataConnect),
  })

  return {
    data: data?.agentConnections ?? EMPTY_CONNECTIONS,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useAgentConnections
