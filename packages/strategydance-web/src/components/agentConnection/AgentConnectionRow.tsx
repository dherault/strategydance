import { useState } from 'react'
import { useIntl } from 'react-intl'
import { useDeleteAgentConnection } from 'strategydance-database/web/react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Dialog, DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { AgentConnection, AgentConnectionMembership } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

import getAgentConnectionDomain from '~utils/agentConnection/getAgentConnectionDomain'
import readAgentConnectionAccess from '~utils/agentConnection/readAgentConnectionAccess'
import getModuleMessages from '~utils/module/getModuleMessages'

import AgentConnectionLastUsed from '~components/agentConnection/AgentConnectionLastUsed'
import AgentConnectionOrganizationsDialog from '~components/agentConnection/AgentConnectionOrganizationsDialog'
import Spinner from '~components/common/Spinner'
import OAuthClientVerification from '~components/oauth/OAuthClientVerification'
import OrganizationMark from '~components/organization/OrganizationMark'

import { dataConnect } from '~data/firebase'
import moduleMessages from '~data/intl/messages/module'

type Props = {
  connection: AgentConnection
  // The reader's, among which the organizations it acts in are changed
  memberships: AgentConnectionMembership[]
  // The time now, from `useNow`, so the last use ages while the tab stays open
  now: number
}

/*
  One connected agent: who it is and what vouches for it, where it connected and the access it
  holds, a module's own address by the module and the one address by Strategy Dance with each
  module it holds there, the organizations it reaches, or that it reaches none of the reader's any
  more, when it connected and when it last called a module, a way to change its organizations, and
  Disconnect, which asks twice, since only a new consent from the agent undoes it. Disconnecting
  deletes the connection with its tokens, so the agent's next call or refresh is refused, and the
  live list drops the row
*/
function AgentConnectionRow({ connection, memberships, now }: Props) {
  const { formatMessage, formatDate } = useIntl()
  const { data: viewer } = useAuthentication()
  const { mutateAsync: deleteConnection, isPending } = useDeleteAgentConnection(dataConnect)
  const [isEditing, setIsEditing] = useState(false)

  const agentName = connection.clientName ?? formatMessage(moduleMessages.unnamedAgent)
  const access = readAgentConnectionAccess(connection)

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
          {access.kind === 'address'
            ? formatMessage(moduleMessages.connectionModule, {
                moduleName: formatMessage(moduleMessages.oneAddressName),
                access: access.modules
                  .map(({ name, isWrite }) =>
                    formatMessage(
                      isWrite ? moduleMessages.connectionModuleReadWrite : moduleMessages.connectionModuleRead,
                      { moduleName: formatMessage(getModuleMessages(name).name) },
                    ),
                  )
                  .join(' '),
              })
            : access.kind === 'module'
              ? formatMessage(moduleMessages.connectionModule, {
                  moduleName: formatMessage(getModuleMessages(access.name).name),
                  access: formatMessage(access.isWrite ? moduleMessages.readWriteAccess : moduleMessages.readAccess),
                })
              : access.name}
        </span>
        {connection.organizations.length ? (
          <ul className="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0 text-xs text-muted-foreground">
            {connection.organizations.map(organization => (
              <li
                key={organization.id}
                className="flex min-w-0 items-center gap-1.5"
              >
                <OrganizationMark
                  name={organization.name}
                  logoUrl={organization.logoThumbnailUrl ?? organization.logoUrl}
                  color={organization.color}
                  size="sm"
                />
                <span className="truncate">{organization.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-muted-foreground">{formatMessage(moduleMessages.connectionReachesNone)}</span>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
      <div className="flex flex-wrap items-center gap-2 self-start sm:shrink-0 sm:self-center">
        <Dialog
          open={isEditing}
          onOpenChange={setIsEditing}
        >
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
            >
              {formatMessage(moduleMessages.editOrganizations)}
            </Button>
          </DialogTrigger>
          <AgentConnectionOrganizationsDialog
            connection={connection}
            memberships={memberships}
            onSaved={() => setIsEditing(false)}
          />
        </Dialog>
        <Button
          variant="outline"
          size="sm"
          confirm={formatMessage(moduleMessages.disconnectConfirm)}
          disabled={isPending}
          icon={isPending ? <Spinner tone="current" /> : undefined}
          onClick={disconnect}
        >
          {formatMessage(moduleMessages.disconnect)}
        </Button>
      </div>
    </li>
  )
}

export default AgentConnectionRow
