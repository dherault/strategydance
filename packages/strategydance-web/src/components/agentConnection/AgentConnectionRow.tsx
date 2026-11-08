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

import AgentConnectionAccessDialog from '~components/agentConnection/AgentConnectionAccessDialog'
import AgentConnectionLastUsed from '~components/agentConnection/AgentConnectionLastUsed'
import AgentConnectionOrganizationsDialog from '~components/agentConnection/AgentConnectionOrganizationsDialog'
import Spinner from '~components/common/Spinner'
import ModuleAgentsDialog from '~components/module/ModuleAgentsDialog'
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
  holds, a module's own address by the module, marked as older with a way to connect at the one
  address, and the one address by Strategy Dance with each module it holds there, the organizations
  it reaches, or that it reaches none of the reader's any more, when it connected and when it last
  called a module, at the one address a way to narrow its access while there is anything to narrow,
  a way to change its organizations, and Disconnect, which asks twice, since only a new consent from
  the agent undoes it. Disconnecting deletes the connection with its tokens, so the agent's next
  call or refresh is refused, and the live list drops the row
*/
function AgentConnectionRow({ connection, memberships, now }: Props) {
  const { formatMessage, formatDate, formatList } = useIntl()
  const { data: viewer } = useAuthentication()
  const { mutateAsync: deleteConnection, isPending } = useDeleteAgentConnection(dataConnect)
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingAccess, setIsEditingAccess] = useState(false)

  const agentName = connection.clientName ?? formatMessage(moduleMessages.unnamedAgent)
  const access = readAgentConnectionAccess(connection)
  // Access narrows, so a connection holding one module at read has nothing it could take away
  const isNarrowable =
    access.kind === 'address' && (access.modules.length > 1 || access.modules.some(({ isWrite }) => isWrite))

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
                // Sentences one after the other, as the locale sets them: a space between them in
                // English, none after a full-width full stop
                access: formatList(
                  access.modules.map(({ name, isWrite }) =>
                    formatMessage(
                      isWrite ? moduleMessages.connectionModuleReadWrite : moduleMessages.connectionModuleRead,
                      { moduleName: formatMessage(getModuleMessages(name).name) },
                    ),
                  ),
                  { type: 'unit', style: 'narrow' },
                ),
              })
            : access.kind === 'module'
              ? formatMessage(moduleMessages.connectionModule, {
                  moduleName: formatMessage(getModuleMessages(access.name).name),
                  access: formatMessage(access.isWrite ? moduleMessages.readWriteAccess : moduleMessages.readAccess),
                })
              : access.name}
        </span>
        {access.kind === 'module' && (
          <span className="text-xs text-muted-foreground">
            {formatMessage(moduleMessages.connectionOlderAddress, {
              moduleName: formatMessage(getModuleMessages(access.name).name),
            })}{' '}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer underline underline-offset-2 hover:text-foreground"
                >
                  {formatMessage(moduleMessages.connectAtOneAddress)}
                </button>
              </DialogTrigger>
              <ModuleAgentsDialog
                module={access.name}
                isOnConnectedAgents
              />
            </Dialog>
          </span>
        )}
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
        {isNarrowable && access.kind === 'address' && (
          <Dialog
            open={isEditingAccess}
            onOpenChange={setIsEditingAccess}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
              >
                {formatMessage(moduleMessages.editAccess)}
              </Button>
            </DialogTrigger>
            <AgentConnectionAccessDialog
              connection={connection}
              modules={access.modules}
              onSaved={() => setIsEditingAccess(false)}
            />
          </Dialog>
        )}
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
