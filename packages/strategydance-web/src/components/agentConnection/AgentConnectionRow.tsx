import { useIntl } from 'react-intl'
import { MODULES } from 'strategydance-core'
import { useDeleteAgentConnection } from 'strategydance-database/web/react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { AgentConnection } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

import getAgentConnectionDomain from '~utils/agentConnection/getAgentConnectionDomain'
import getModuleMessages from '~utils/module/getModuleMessages'

import AgentConnectionLastUsed from '~components/agentConnection/AgentConnectionLastUsed'
import Spinner from '~components/common/Spinner'
import OAuthClientVerification from '~components/oauth/OAuthClientVerification'
import OrganizationMark from '~components/organization/OrganizationMark'

import { dataConnect } from '~data/firebase'
import moduleMessages from '~data/intl/messages/module'

type Props = {
  connection: AgentConnection
  // The time now, from `useNow`, so the last use ages while the tab stays open
  now: number
}

/*
  One connected agent: who it is and what vouches for it, the module and the access it holds, the
  organization it acts in, when it connected and when it last called the module, and Disconnect,
  which asks twice, since only a new consent from the agent undoes it. Disconnecting deletes the
  connection with its tokens, so the agent's next call or refresh is refused, and the live list
  drops the row
*/
function AgentConnectionRow({ connection, now }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { data: viewer } = useAuthentication()
  const { mutateAsync: deleteConnection, isPending } = useDeleteAgentConnection(dataConnect)

  const agentName = connection.clientName ?? formatMessage(moduleMessages.unnamedAgent)
  const definition = MODULES.find(({ name }) => name === connection.module)
  const { organization } = connection.membership

  async function disconnect() {
    if (!viewer) return

    try {
      await deleteConnection({ userId: viewer.uid, id: connection.id })

      toast.success(formatMessage(moduleMessages.disconnected, { agentName }))
    } catch (error) {
      console.error('Failed to disconnect the agent', error)

      toast.error(formatMessage(moduleMessages.disconnectError, { agentName }))
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-md border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium wrap-break-word text-foreground">{agentName}</span>
          <OAuthClientVerification
            domain={getAgentConnectionDomain(connection.clientId)}
            className="text-sm text-muted-foreground"
          />
        </div>
        <span className="text-sm text-foreground">
          {definition
            ? formatMessage(moduleMessages.connectionModule, {
                moduleName: formatMessage(getModuleMessages(definition.name).name),
                access: formatMessage(
                  connection.scopes.includes(definition.scopes.write)
                    ? moduleMessages.readWriteAccess
                    : moduleMessages.readAccess,
                ),
              })
            : connection.module}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <OrganizationMark
              name={organization.name}
              logoUrl={organization.logoThumbnailUrl ?? organization.logoUrl}
              color={organization.color}
              size="sm"
            />
            <span className="truncate">{organization.name}</span>
          </span>
          <time
            dateTime={connection.createdAt}
            title={formatDate(connection.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
          >
            {formatMessage(moduleMessages.connectedOn, {
              date: formatDate(connection.createdAt, { month: 'short', day: 'numeric', year: 'numeric' }),
            })}
          </time>
          <AgentConnectionLastUsed
            lastUsedAt={connection.lastUsedAt ?? null}
            now={now}
          />
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        confirm={formatMessage(moduleMessages.disconnectConfirm)}
        disabled={isPending}
        icon={isPending ? <Spinner tone="current" /> : undefined}
        onClick={disconnect}
        className="self-start sm:self-center"
      >
        {formatMessage(moduleMessages.disconnect)}
      </Button>
    </li>
  )
}

export default AgentConnectionRow
