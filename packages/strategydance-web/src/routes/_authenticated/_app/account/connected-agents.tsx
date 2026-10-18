import { createFileRoute } from '@tanstack/react-router'

import AccountConnectedAgents from '~components/agentConnection/AccountConnectedAgents'
import AgentConnectionsWait from '~components/agentConnection/AgentConnectionsWait'

/*
  The external agents the reader connected, under the account page. Its words are the `module`
  catalogue's, which `_app` registers
*/
export const Route = createFileRoute('/_authenticated/_app/account/connected-agents')({
  component: AccountConnectedAgentsRoute,
})

function AccountConnectedAgentsRoute() {
  return (
    <AgentConnectionsWait>
      <AccountConnectedAgents />
    </AgentConnectionsWait>
  )
}
