import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import parseIntegrationsSearch from '~utils/integration/parseIntegrationsSearch'

import Integrations from '~components/integration/Integrations'
import IntegrationsWait from '~components/integration/IntegrationsWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const INTEGRATION_MESSAGE_TYPES: MessageType[] = ['integration', 'externalMcpServer']

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/integrations')({
  // A conversation's thread sends the reader here to open, connect, turn on or add a server
  validateSearch: parseIntegrationsSearch,
  component: IntegrationsRoute,
})

/*
  The page is keyed by the organization, so switching organizations mounts it anew, with no dialog
  left open on another organization's server
*/
function IntegrationsRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntlMessagesRegistration messageTypes={INTEGRATION_MESSAGE_TYPES}>
      <IntegrationsWait>
        <Integrations key={organization?.id ?? 'none'} />
      </IntegrationsWait>
    </IntlMessagesRegistration>
  )
}
