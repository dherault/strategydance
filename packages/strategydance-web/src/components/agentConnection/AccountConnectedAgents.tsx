import { BotIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import useAgentConnections from '~hooks/agentConnection/useAgentConnections'
import useNow from '~hooks/common/useNow'

import AgentConnectionRow from '~components/agentConnection/AgentConnectionRow'
import Spinner from '~components/common/Spinner'

import globalMessages from '~data/intl/messages/global'
import moduleMessages from '~data/intl/messages/module'

/*
  The account page's Connected agents tab: the external agents the reader allowed to act as them,
  each with Disconnect, newest first; or that there are none; or that the list could not be read,
  with a way to try again rather than a verdict on an empty list
*/
function AccountConnectedAgents() {
  const { formatMessage } = useIntl()
  const { data: connections, hasFailed, loading, refetch } = useAgentConnections()
  const now = useNow()

  if (hasFailed) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert
          variant="danger"
          className="max-w-xl"
        >
          {formatMessage(moduleMessages.connectedAgentsLoadError)}
        </Alert>
        <Button
          variant="outline"
          disabled={loading}
          icon={loading ? <Spinner tone="current" /> : undefined}
          onClick={refetch}
        >
          {formatMessage(globalMessages.retry)}
        </Button>
      </div>
    )
  }

  if (!connections.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <BotIcon />
          </EmptyMedia>
          <EmptyTitle>{formatMessage(moduleMessages.connectedAgentsEmptyTitle)}</EmptyTitle>
          <EmptyDescription>{formatMessage(moduleMessages.connectedAgentsEmptyDescription)}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 max-w-xl text-sm text-pretty text-muted-foreground">
        {formatMessage(moduleMessages.connectedAgentsLead)}
      </p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {connections.map(connection => (
          <AgentConnectionRow
            key={connection.id}
            connection={connection}
            now={now}
          />
        ))}
      </ul>
    </div>
  )
}

export default AccountConnectedAgents
