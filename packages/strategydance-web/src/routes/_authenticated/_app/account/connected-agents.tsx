import { createFileRoute } from '@tanstack/react-router'

import AccountConnectedAgents from '~components/agentConnection/AccountConnectedAgents'
import AgentConnectionsWait from '~components/agentConnection/AgentConnectionsWait'
import ConnectedAgentsReleaseBouncer from '~components/agentConnection/ConnectedAgentsReleaseBouncer'

/*
  The external agents the reader connected, under the account page. Its words are the `module`
  catalogue's, which `_app` registers. The bouncer comes first, so nothing is read for a reader the
  tab is not offered to
*/
export const Route = createFileRoute('/_authenticated/_app/account/connected-agents')({
  component: AccountConnectedAgentsRoute,
})

function AccountConnectedAgentsRoute() {
  return (
    <ConnectedAgentsReleaseBouncer>
      <AgentConnectionsWait>
        <AccountConnectedAgents />
      </AgentConnectionsWait>
    </ConnectedAgentsReleaseBouncer>
  )
}
