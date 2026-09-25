import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getOrganizationInvitationRef } from 'strategydance-database/web'

import type { DataSource, OrganizationInvitation } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

import { dataConnect } from '~data/firebase'

/*
  The invitation a link names, when it was sent to the signed-in reader's address, or null.

  Null covers every way it can be missing: canceled, answered already, sent to another address,
  or an id that is not one at all, which Data Connect refuses rather than answers. The page says
  the same thing for all of them, since telling them apart would tell a stranger holding the link
  which addresses were invited.

  The key carries the uid, so signing into another account on the same tab reads the invitation
  again as that account
*/
function useOrganizationInvitation(invitationId: string): DataSource<OrganizationInvitation | null> {
  const { data: viewer } = useAuthentication()

  const viewerId = viewer?.uid ?? null

  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ['GetOrganizationInvitation', invitationId, viewerId],
    queryFn: async () => {
      try {
        const { data: result } = await executeQuery(getOrganizationInvitationRef(dataConnect, { id: invitationId }))

        return result.organizationInvitations[0] ?? null
      }
      catch (error) {
        console.error('Failed to read the invitation', error)

        return null
      }
    },
    enabled: Boolean(viewerId),
  })

  return {
    data: data ?? null,
    initialLoading: Boolean(viewerId) && isPending,
    loading: Boolean(viewerId) && isFetching,
    refetch: async () => {
      await refetch()
    },
  }
}

export default useOrganizationInvitation
