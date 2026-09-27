import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getAdministrationOrganizationsRef } from 'strategydance-database/web'

import type { AdministrationOrganization, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

import { dataConnect } from '~data/firebase'

// At module scope so an empty answer is the same array on every render
const NO_ORGANIZATIONS: AdministrationOrganization[] = []

/*
  Every organization, newest first, for an administrator of Strategy Dance. Read, keyed and
  retried as `useAdministrationUsers` reads the accounts, for the same reasons:
  `AdministrationOrganizationsWait` and the page both read it
*/
function useAdministrationOrganizations(): DataSource<AdministrationOrganization[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()

  const viewerId = viewer?.uid ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetAdministrationOrganizations', viewerId],
    queryFn: async () => {
      const { data: result } = await executeQuery(getAdministrationOrganizationsRef(dataConnect))

      return result.organizations
    },
    enabled: Boolean(viewerId),
    retryOnMount: false,
  })

  return {
    data: data ?? NO_ORGANIZATIONS,
    initialLoading: Boolean(viewerId) && isPending && !isError,
    loading: Boolean(viewerId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(viewerId) && isError && data === undefined,
  }
}

export default useAdministrationOrganizations
