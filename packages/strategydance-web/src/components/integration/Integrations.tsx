import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { OrganizationRole } from 'strategydance-database/web'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { EXTERNAL_MCP_SERVERS, type ExternalMcpServer } from 'strategydance-external-mcp-servers'

import type { OrganizationIntegration } from '~types'

import useIntegrationConnect from '~hooks/integration/useIntegrationConnect'
import useIntegrationConnections from '~hooks/integration/useIntegrationConnections'
import useIntegrationRequests from '~hooks/integration/useIntegrationRequests'
import useOrganizationIntegrations from '~hooks/integration/useOrganizationIntegrations'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getIntegrationFailureMessage from '~utils/integration/getIntegrationFailureMessage'
import getIntegrationFormKey from '~utils/integration/getIntegrationFormKey'
import getIntegrationStatus from '~utils/integration/getIntegrationStatus'
import readIntegrationFailure from '~utils/integration/readIntegrationFailure'

import IntegrationConnectDialog from '~components/integration/IntegrationConnectDialog'
import IntegrationDialog from '~components/integration/IntegrationDialog'
import IntegrationGallery from '~components/integration/IntegrationGallery'
import IntegrationsEmpty from '~components/integration/IntegrationsEmpty'
import IntegrationsHeader from '~components/integration/IntegrationsHeader'
import IntegrationsLoadFailed from '~components/integration/IntegrationsLoadFailed'
import IntegrationsTable from '~components/integration/IntegrationsTable'
import ContainerLayout from '~components/layout/ContainerLayout'

import integrationMessages from '~data/intl/messages/integration'

// The dialog open: a server of the organization by its id, or one being added, from the gallery or not
type OpenDialog = { integrationId: string } | { preset: ExternalMcpServer | null }

/*
  The organization's MCP servers, which Strategy Dance can call in conversations: a table of them,
  each opening its dialog, and for administrators the gallery of popular servers not added yet, as
  designed. Every member reads them, each server's status their own, and connects their own account
  to a server taking OAuth, from its row or its dialog, waiting in the connect dialog while they sign
  in; only administrators add, change, turn on and off, and delete.

  The dialog of a server is mounted only while open, around the server it shows, read from the live
  list, so another administrator's change reaches it, mounting it anew when it changes a setting its
  form edits (`getIntegrationFormKey`), and it closes when the server goes. A delete offers its Undo
  in a toast, as conversations' does.

  A conversation's thread sends the reader here from under a call to a server that does not work for
  them, and the page does what its query says once, then takes it out of the address: opens a server's
  dialog, the reader's own Connect in it, since a browser opens a sign-in window only inside a click;
  turns a server on, for an administrator; or opens the dialog adding a server again, from the
  catalogue when it lists one by that name
*/
function Integrations() {
  const { formatMessage } = useIntl()
  const { organization, role } = useCurrentOrganization()
  const { data: integrations, loading, refetch, hasFailed: hasIntegrationsFailed } = useOrganizationIntegrations()
  const {
    data: connections,
    loading: connectionsLoading,
    refetch: refetchConnections,
    hasFailed: hasConnectionsFailed,
  } = useIntegrationConnections()
  const { setIntegrationEnabled, deleteIntegration, restoreIntegration } = useIntegrationRequests()
  const { attempt, connect, cancel } = useIntegrationConnect(connections)
  const [openDialog, setOpenDialog] = useState<OpenDialog | null>(null)
  const search = useSearch({ from: '/_authenticated/_app/$organizationSlug/integrations' })
  const navigate = useNavigate({ from: '/$organizationSlug/integrations' })

  const isAdministrator = role === OrganizationRole.ADMINISTRATOR
  const openIntegration =
    openDialog && 'integrationId' in openDialog
      ? (integrations.find(({ id }) => id === openDialog.integrationId) ?? null)
      : null
  const isDialogOpen = openDialog !== null && ('preset' in openDialog || openIntegration !== null)
  const hasFailed = hasIntegrationsFailed || hasConnectionsFailed
  const findConnection = (integrationId: string) =>
    connections.find(connection => connection.integrationId === integrationId) ?? null
  const available = integrations.filter(
    integration => getIntegrationStatus(integration, findConnection(integration.id)) === 'connected',
  ).length

  useEffect(() => {
    const { open, connect: connectId, enable, add } = search

    if (!open && !connectId && !enable && !add) return

    const findIntegration = (id: string | undefined) =>
      id ? integrations.find(integration => integration.id === id.replaceAll('-', '').toLowerCase()) : undefined
    const opened = findIntegration(open ?? connectId)
    const enabled = isAdministrator ? findIntegration(enable) : undefined

    if (opened) setOpenDialog({ integrationId: opened.id })
    else if (add && isAdministrator) {
      const name = add.trim().toLowerCase()

      setOpenDialog({ preset: EXTERNAL_MCP_SERVERS.find(server => server.name.toLowerCase() === name) ?? null })
    }

    if (enabled && !enabled.isEnabled) toggle(enabled, true)

    navigate({ search: {}, replace: true })
    // Once for each query the thread sends, against the servers as they are then
    // oxlint-disable-next-line react/exhaustive-deps
  }, [search])

  // Connect from the server's dialog closes it, the connect dialog taking its place, as designed
  function startConnecting(integration: OrganizationIntegration) {
    setOpenDialog(null)
    connect(integration).catch((error: unknown) => console.error('A Connect could not start', error))
  }

  async function toggle(integration: OrganizationIntegration, isEnabled: boolean) {
    try {
      await setIntegrationEnabled(integration.id, isEnabled)
      toast(
        formatMessage(isEnabled ? integrationMessages.turnedOn : integrationMessages.turnedOff, {
          name: integration.name,
        }),
      )
    } catch (error) {
      console.error('A server could not be turned on or off', error)
      toast.error(formatMessage(integrationMessages.toggleError, { name: integration.name }))
    }
  }

  async function remove(integration: OrganizationIntegration) {
    setOpenDialog(null)

    try {
      await deleteIntegration(integration.id)
    } catch (error) {
      console.error('A server could not be deleted', error)
      toast.error(formatMessage(integrationMessages.deleteError, { name: integration.name }))

      return
    }

    toast(formatMessage(integrationMessages.deleted, { name: integration.name }), {
      action: {
        label: formatMessage(integrationMessages.undo),
        onClick: () => {
          restoreIntegration(integration.id).catch((error: unknown) => {
            console.error('A server could not be brought back', error)

            const failure = readIntegrationFailure(error)

            toast.error(
              failure === 'unknown'
                ? formatMessage(integrationMessages.restoreError, { name: integration.name })
                : formatMessage(getIntegrationFailureMessage(failure)),
            )
          })
        },
      },
    })
  }

  return (
    <ContainerLayout className="gap-8">
      <IntegrationsHeader
        counts={hasFailed ? null : { available, total: integrations.length }}
        isAdministrator={isAdministrator}
        onAdd={() => setOpenDialog({ preset: null })}
      />
      {organization && hasFailed ? (
        <IntegrationsLoadFailed
          isRetrying={loading || connectionsLoading}
          onRetry={() => Promise.all([refetch(), refetchConnections()]).then(() => {})}
        />
      ) : null}
      {organization && !hasFailed && integrations.length ? (
        <IntegrationsTable
          integrations={integrations}
          connections={connections}
          isAdministrator={isAdministrator}
          onOpen={integration => setOpenDialog({ integrationId: integration.id })}
          onToggle={toggle}
          onConnect={startConnecting}
        />
      ) : null}
      {organization && !hasFailed && !integrations.length ? (
        <IntegrationsEmpty onAdd={isAdministrator ? () => setOpenDialog({ preset: null }) : null} />
      ) : null}
      {organization && !hasFailed && isAdministrator ? (
        <IntegrationGallery
          integrations={integrations}
          onAdd={server => setOpenDialog({ preset: server })}
        />
      ) : null}
      {isDialogOpen ? (
        <IntegrationDialog
          key={openIntegration ? getIntegrationFormKey(openIntegration) : 'new'}
          integration={openIntegration}
          preset={openDialog && 'preset' in openDialog ? openDialog.preset : null}
          integrations={integrations}
          isAdministrator={isAdministrator}
          connection={openIntegration ? findConnection(openIntegration.id) : null}
          onClose={() => setOpenDialog(null)}
          onDelete={remove}
          onConnect={startConnecting}
        />
      ) : null}
      {attempt ? (
        <IntegrationConnectDialog
          attempt={attempt}
          onCancel={cancel}
          onRetry={() => startConnecting(attempt.integration)}
        />
      ) : null}
    </ContainerLayout>
  )
}

export default Integrations
