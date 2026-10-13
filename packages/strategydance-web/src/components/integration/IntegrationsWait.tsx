import type { PropsWithChildren } from 'react'

import useOrganizationIntegrations from '~hooks/integration/useOrganizationIntegrations'

import Loading from '~components/common/Loading'

/*
  Holds the Integrations page until its first read lands. `initialLoading` rather than `loading`,
  since the live query writes over the list while somebody is looking at it
*/
function IntegrationsWait({ children }: PropsWithChildren) {
  const { initialLoading } = useOrganizationIntegrations()

  if (initialLoading) {
    return <Loading source="IntegrationsWait" />
  }

  return children
}

export default IntegrationsWait
