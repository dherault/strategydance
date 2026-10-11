import type { PropsWithChildren } from 'react'

import useAgentConnections from '~hooks/agentConnection/useAgentConnections'

import Loading from '~components/common/Loading'

/*
  Holds the Connected agents tab until its first read lands. `initialLoading` rather than
  `loading`, since the live query writes over the list while somebody is looking at it, and a
  refetch on focus must not blank the tab either
*/
function AgentConnectionsWait({ children }: PropsWithChildren) {
  const { initialLoading } = useAgentConnections()

  if (initialLoading) {
    return <Loading source="AgentConnectionsWait" />
  }

  return children
}

export default AgentConnectionsWait
