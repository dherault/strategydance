import type { PropsWithChildren } from 'react'

import useIntegrationConnections from '~hooks/integration/useIntegrationConnections'
import useOrganizationIntegrations from '~hooks/integration/useOrganizationIntegrations'

import Loading from '~components/common/Loading'

/*
  Holds the Integrations page until its first reads land: the servers, and the reader's own accounts
  at them, which say where each stands for them. `initialLoading` rather than `loading`, since the
  live queries write over the lists while somebody is looking at them
*/
function IntegrationsWait({ children }: PropsWithChildren) {
  const { initialLoading } = useOrganizationIntegrations()
  const { initialLoading: initialConnectionsLoading } = useIntegrationConnections()

  if (initialLoading || initialConnectionsLoading) {
    return <Loading source="IntegrationsWait" />
  }

  return children
}

export default IntegrationsWait
