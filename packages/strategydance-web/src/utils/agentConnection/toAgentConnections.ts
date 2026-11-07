import { readAgentConnectionReach } from 'strategydance-core'
import type { GetAgentConnectionsData } from 'strategydance-database/web'

import type { AgentConnection, AgentConnectionMembership } from '~types'

/*
  The reader's connections as the Connected agents tab lists them, each with the organizations it
  reaches, in the order the reader joined them: those it lists whose membership predates its grant,
  as the backend's verifier reads them, so the tab never shows an organization the agent cannot act
  in. Beside them, the reader's memberships, which an edit of a connection's organizations chooses
  among
*/
function toAgentConnections({ agentConnections, memberships }: GetAgentConnectionsData): {
  connections: AgentConnection[]
  memberships: AgentConnectionMembership[]
} {
  return {
    connections: agentConnections.map(connection => ({
      ...connection,
      organizations: readAgentConnectionReach(connection, memberships).map(({ organization }) => organization),
    })),
    memberships,
  }
}

export default toAgentConnections
