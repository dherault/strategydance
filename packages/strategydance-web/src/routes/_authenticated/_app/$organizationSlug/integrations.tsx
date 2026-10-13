import { createFileRoute } from '@tanstack/react-router'

import type { MessageType } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import Integrations from '~components/integration/Integrations'
import IntegrationsReleaseBouncer from '~components/integration/IntegrationsReleaseBouncer'
import IntegrationsWait from '~components/integration/IntegrationsWait'
import IntlMessagesRegistration from '~components/intl/IntlMessagesRegistration'

// At module scope so the reference is stable across renders
const INTEGRATION_MESSAGE_TYPES: MessageType[] = ['integration', 'externalMcpServer']

export const Route = createFileRoute('/_authenticated/_app/$organizationSlug/integrations')({
  component: IntegrationsRoute,
})

/*
  The bouncer stands outside the catalogues, so a reader the gate turns away never loads them. The
  page is keyed by the organization, so switching organizations mounts it anew, with no dialog left
  open on another organization's server
*/
function IntegrationsRoute() {
  const { organization } = useCurrentOrganization()

  return (
    <IntegrationsReleaseBouncer>
      <IntlMessagesRegistration messageTypes={INTEGRATION_MESSAGE_TYPES}>
        <IntegrationsWait>
          <Integrations key={organization?.id ?? 'none'} />
        </IntegrationsWait>
      </IntlMessagesRegistration>
    </IntegrationsReleaseBouncer>
  )
}
