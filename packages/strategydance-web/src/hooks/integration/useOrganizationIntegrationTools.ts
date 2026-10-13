import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getOrganizationIntegrationToolsRef } from 'strategydance-database/web'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import parseIntegrationTools from '~utils/integration/parseIntegrationTools'

import { dataConnect } from '~data/firebase'

const NO_APPROVALS: string[] = []

/*
  One server's tools as it last listed them, and the hashes of the ones its administrators let run
  without approval, kept live while its dialog is open, apart from the list so the table's
  refreshes never carry every server's schemas. `GetOrganizationIntegrationTools` refreshes on every
  write that changes either
*/
function useOrganizationIntegrationTools(integrationId: string) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const queryKey = ['GetOrganizationIntegrationTools', organizationId, integrationId]

  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: tools } = await executeQuery(
        getOrganizationIntegrationToolsRef(dataConnect, { organizationId: organizationId!, integrationId }),
      )

      return tools
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'integrationTools',
    queryKey: organizationId ? queryKey : null,
    createQueryRef: () =>
      getOrganizationIntegrationToolsRef(dataConnect, { organizationId: organizationId!, integrationId }),
  })

  const row = data?.organizationIntegrations[0]

  return {
    tools: parseIntegrationTools(row?.tools),
    autoApprovedTools: row?.autoApprovedTools ?? NO_APPROVALS,
    isLoading: isPending && !isError,
    hasFailed: isError && data === undefined,
  }
}

export default useOrganizationIntegrationTools
