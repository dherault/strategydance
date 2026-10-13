import { useState } from 'react'
import { useIntl } from 'react-intl'
import { OrganizationRole } from 'strategydance-database/web'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import type { ExternalMcpServer } from 'strategydance-external-mcp-servers'

import type { OrganizationIntegration } from '~types'

import useIntegrationRequests from '~hooks/integration/useIntegrationRequests'
import useOrganizationIntegrations from '~hooks/integration/useOrganizationIntegrations'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getIntegrationFailureMessage from '~utils/integration/getIntegrationFailureMessage'
import getIntegrationFormKey from '~utils/integration/getIntegrationFormKey'
import getIntegrationStatus from '~utils/integration/getIntegrationStatus'
import readIntegrationFailure from '~utils/integration/readIntegrationFailure'

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
  designed. Every member reads them; only administrators add, change, turn on and off, and delete.

  The dialog of a server is mounted only while open, around the server it shows, read from the live
  list, so another administrator's change reaches it, mounting it anew when it changes a setting its
  form edits (`getIntegrationFormKey`), and it closes when the server goes. A delete offers its Undo
  in a toast, as conversations' does
*/
function Integrations() {
  const { formatMessage } = useIntl()
  const { organization, role } = useCurrentOrganization()
  const { data: integrations, loading, refetch, hasFailed } = useOrganizationIntegrations()
  const { setIntegrationEnabled, deleteIntegration, restoreIntegration } = useIntegrationRequests()
  const [openDialog, setOpenDialog] = useState<OpenDialog | null>(null)

  const isAdministrator = role === OrganizationRole.ADMINISTRATOR
  const openIntegration =
    openDialog && 'integrationId' in openDialog
      ? (integrations.find(({ id }) => id === openDialog.integrationId) ?? null)
      : null
  const isDialogOpen = openDialog !== null && ('preset' in openDialog || openIntegration !== null)
  const available = integrations.filter(integration => getIntegrationStatus(integration) === 'connected').length

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
          isRetrying={loading}
          onRetry={refetch}
        />
      ) : null}
      {organization && !hasFailed && integrations.length ? (
        <IntegrationsTable
          integrations={integrations}
          isAdministrator={isAdministrator}
          onOpen={integration => setOpenDialog({ integrationId: integration.id })}
          onToggle={toggle}
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
          onClose={() => setOpenDialog(null)}
          onDelete={remove}
        />
      ) : null}
    </ContainerLayout>
  )
}

export default Integrations
