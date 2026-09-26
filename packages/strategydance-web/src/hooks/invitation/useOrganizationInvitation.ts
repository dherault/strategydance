import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getOrganizationInvitationRef } from 'strategydance-database/web'

import type { DataSource, OrganizationInvitation } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'

import { dataConnect } from '~data/firebase'

// A UUID as Data Connect writes it, 32 hex digits, or with its hyphens
const INVITATION_ID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

/*
  The invitation a link names, when it was sent to the signed-in reader's address, or null.

  Null covers every way it can be missing: canceled, answered already, sent to another address,
  or an id that is not one at all, which is answered here rather than sent to a server that would
  only refuse it. The page says the same thing for all of them, since telling them apart would
  tell a stranger holding the link which addresses were invited.

  A read that fails is not a missing invitation, and is not cached as one: it throws, TanStack
  retries it, and `hasFailed` lets the page offer to try again rather than tell an invitee their
  invitation is gone because the network was.

  The key carries the uid, so signing into another account on the same tab reads the invitation
  again as that account.

  Nothing is read until the reader's address is verified, which the query requires: asked
  before, it would fail, and the page would offer to try again something that cannot succeed.
  The page asks them to confirm their address instead
*/
function useOrganizationInvitation(invitationId: string): DataSource<OrganizationInvitation | null> & { hasFailed: boolean } {
  const { data: viewer, emailVerified } = useAuthentication()

  // Null until somebody may read: signed in, with a verified address
  const readerId = viewer && emailVerified ? viewer.uid : null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetOrganizationInvitation', invitationId, readerId],
    queryFn: async () => {
      if (!INVITATION_ID_PATTERN.test(invitationId)) return null

      const { data: result } = await executeQuery(getOrganizationInvitationRef(dataConnect, { id: invitationId }))

      return result.organizationInvitations[0] ?? null
    },
    enabled: Boolean(readerId),
    /*
      A read that failed with nothing cached must not start again because another component
      subscribed. Retrying resets it to pending, the waiter puts the spinner back and unmounts the
      page, the page mounts again once it fails, and the loop never ends. Trying again is the
      failure view's button to press
    */
    retryOnMount: false,
  })

  return {
    data: data ?? null,
    initialLoading: Boolean(readerId) && isPending && !isError,
    loading: Boolean(readerId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isError && data === undefined,
  }
}

export default useOrganizationInvitation
