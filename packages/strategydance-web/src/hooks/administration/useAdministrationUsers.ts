import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getAdministrationUsersRef } from 'strategydance-database/web'

import type { AdministrationUser, DataSource } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

import { dataConnect } from '~data/firebase'

// At module scope so an empty answer is the same array on every render
const NO_USERS: AdministrationUser[] = []

/*
  Every account, newest first, for an administrator of Strategy Dance. The query checks the flag
  itself, and only what `AdministrationBouncer` lets through calls this, so nobody else asks.

  Not live: TanStack reads it again when the page mounts and when the window regains focus.

  The key carries the uid, so signing into another account on the same tab reads the list again
  as that account. A read that fails is not an empty list: `hasFailed` says so, and the page offers
  to try again. It does not retry on mount, since with nothing cached a retry resets the query to
  pending, `AdministrationUsersWait` unmounts the page, and the page's return would retry again,
  forever
*/
function useAdministrationUsers(): DataSource<AdministrationUser[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()

  const viewerId = viewer?.uid ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetAdministrationUsers', viewerId],
    queryFn: async () => {
      const { data: result } = await executeQuery(getAdministrationUsersRef(dataConnect))

      return result.users
    },
    enabled: Boolean(viewerId),
    retryOnMount: false,
  })

  return {
    data: data ?? NO_USERS,
    initialLoading: Boolean(viewerId) && isPending && !isError,
    loading: Boolean(viewerId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(viewerId) && isError && data === undefined,
  }
}

export default useAdministrationUsers
