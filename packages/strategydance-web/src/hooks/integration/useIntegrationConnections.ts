import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getIntegrationConnectionsRef } from 'strategydance-database/web'

import type { DataSource, IntegrationConnection } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const NO_CONNECTIONS: IntegrationConnection[] = []

/*
  The reader's own accounts at the current organization's OAuth servers, kept live, as
  `useOrganizationIntegrations` keeps the servers: what says, for each, whether it works for them, as
  whom, and when a Connect of theirs lands, which the connect dialog waits on. Never a token.

  `useQuery` rather than the generated hook, for the reason `useOrganizationTeam` gives, and no retry
  on mount, with `hasFailed` telling a list that could not be read from an empty one
*/
function useIntegrationConnections(): DataSource<IntegrationConnection[]> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetIntegrationConnections', organizationId],
    queryFn: async () => {
      const { data: connections } = await executeQuery(
        getIntegrationConnectionsRef(dataConnect, { organizationId: organizationId! }),
      )

      return connections
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'integrationConnections',
    queryKey: organizationId ? ['GetIntegrationConnections', organizationId] : null,
    createQueryRef: () => getIntegrationConnectionsRef(dataConnect, { organizationId: organizationId! }),
  })

  return {
    data: data?.integrationConnections ?? NO_CONNECTIONS,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useIntegrationConnections
