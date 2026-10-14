import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getOrganizationIntegrationsRef } from 'strategydance-database/web'

import type { DataSource, OrganizationIntegration } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const NO_INTEGRATIONS: OrganizationIntegration[] = []

/*
  The current organization's MCP servers, kept live, as `useOrganizationTeam` keeps the team: an
  ordinary first read, which `IntegrationsWait` waits on, and a subscription that writes each pushed
  result into the same cache entry, `GetOrganizationIntegrations` naming every write that changes a
  server. Nothing on the page refetches after it writes: an administrator's own change and another's
  arrive the same way.

  `useQuery` rather than the generated hook, for the reason `useOrganizationTeam` gives, and no retry
  on mount, with `hasFailed` telling a list that could not be read from an empty one
*/
function useOrganizationIntegrations({ isEnabled = true } = {}): DataSource<OrganizationIntegration[]> & {
  hasFailed: boolean
} {
  const { organization } = useCurrentOrganization()

  // Nothing is read while the caller has no use for the list, as a thread with no call to a server
  const organizationId = isEnabled ? (organization?.id ?? null) : null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetOrganizationIntegrations', organizationId],
    queryFn: async () => {
      const { data: integrations } = await executeQuery(
        getOrganizationIntegrationsRef(dataConnect, { organizationId: organizationId! }),
      )

      return integrations
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'integrations',
    queryKey: organizationId ? ['GetOrganizationIntegrations', organizationId] : null,
    createQueryRef: () => getOrganizationIntegrationsRef(dataConnect, { organizationId: organizationId! }),
  })

  return {
    data: data?.organizationIntegrations ?? NO_INTEGRATIONS,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useOrganizationIntegrations
