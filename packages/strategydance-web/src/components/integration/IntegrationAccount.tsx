import { PlugIcon, UnplugIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { IntegrationConnectionStatus } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { IntegrationConnection, OrganizationIntegration } from '~types'

import useIntegrationConnectionRequests from '~hooks/integration/useIntegrationConnectionRequests'

import Spinner from '~components/common/Spinner'

import integrationMessages from '~data/intl/messages/integration'

type Props = {
  integration: OrganizationIntegration
  // The reader's own connection to the server, or null when they have none
  connection: IntegrationConnection | null
  onConnect: () => void
}

/*
  The reader's own account at a server taking OAuth, in the server's dialog, as designed: connected,
  as the account the server named, or since the day they connected when it named none, with
  Disconnect; not connected, with Connect; or no longer taken, with Connect again. Every member sees
  their own, and connects and disconnects nobody but themselves
*/
function IntegrationAccount({ integration, connection, onConnect }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { disconnect } = useIntegrationConnectionRequests()
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const isConnected = connection?.status === IntegrationConnectionStatus.CONNECTED
  const name = integration.name

  async function handleDisconnect() {
    setIsDisconnecting(true)

    try {
      await disconnect(integration.id)
      toast(formatMessage(integrationMessages.disconnected, { name }))
    } catch (error) {
      console.error('An account could not be disconnected', error)
      toast.error(formatMessage(integrationMessages.disconnectError, { name }))
    } finally {
      setIsDisconnecting(false)
    }
  }

  function renderText() {
    if (connection && isConnected) {
      return (
        <>
          <strong className="font-medium text-foreground">{formatMessage(integrationMessages.accountConnected)}</strong>
          <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
            {connection.accountLabel
              ? formatMessage(integrationMessages.accountConnectedAs, { account: connection.accountLabel })
              : formatMessage(integrationMessages.accountConnectedSince, {
                  date: formatDate(connection.createdAt, { dateStyle: 'medium' }),
                })}
          </p>
        </>
      )
    }

    return (
      <>
        <strong className="font-medium text-foreground">
          {formatMessage(
            connection ? integrationMessages.statusNeedsAuthentication : integrationMessages.accountNotConnected,
          )}
        </strong>
        <p className="m-0 mt-0.5 text-xs text-pretty text-muted-foreground">
          {formatMessage(
            connection ? integrationMessages.accountExpiredHint : integrationMessages.accountNotConnectedHint,
            { name },
          )}
        </p>
      </>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xs border border-border p-3">
      <div className="min-w-0 text-sm text-foreground">{renderText()}</div>
      {isConnected ? (
        <Button
          variant="outline"
          size="sm"
          disabled={isDisconnecting}
          icon={isDisconnecting ? <Spinner tone="current" /> : <UnplugIcon />}
          confirm={formatMessage(integrationMessages.disconnectConfirm)}
          onClick={handleDisconnect}
        >
          {formatMessage(integrationMessages.disconnect)}
        </Button>
      ) : (
        <Button
          size="sm"
          icon={<PlugIcon />}
          onClick={onConnect}
        >
          {formatMessage(integrationMessages.connect)}
        </Button>
      )}
    </div>
  )
}

export default IntegrationAccount
