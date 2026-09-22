import type { PropsWithChildren } from 'react'
import { useCreateOrganization, useGetCurrentUserOrganizations } from 'strategydance-database/web/react'

import type { OrganizationContextType } from '~contexts/OrganizationContext'

import OrganizationContext from '~contexts/OrganizationContext'

import useAuthentication from '~hooks/authentication/useAuthentication'
import usePersistedState from '~hooks/common/usePersistedState'

import { dataConnect } from '~data/firebase'

/*
  Owns the reader's memberships, and which organization they are looking at.

  Mounted in `Wrap` below `_UserProvider`, and like every provider there it renders its children
  unconditionally. `OrganizationsWait` is the half that gates
*/
function OrganizationProvider({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()

  const viewerId = viewer?.uid ?? null

  /*
    The key stays a literal. A template carrying the uid looks like the fix for two accounts on
    one browser and is not: `usePersistedState` runs its initializer once, so signing into a
    second account in the same tab would keep the first one's selection under the second one's
    key. The derivation below is what actually handles that
  */
  const [organizationId, setOrganizationId] = usePersistedState<string | null>('organizationId', null)

  /*
    The query key carries the uid, so signing into a second account on the same tab does not read
    the first one's list out of the cache while the new request is in flight.

    `enabled` keeps it from running for a signed out reader, whose token the `@auth(level: USER)`
    operation would refuse anyway
  */
  const { data, isPending, isError, refetch: refetchOrganizations } = useGetCurrentUserOrganizations(dataConnect, {
    queryKey: ['GetCurrentUserOrganizations', viewerId],
    enabled: Boolean(viewerId),
  })

  const { mutateAsync: createOrganizationMutation } = useCreateOrganization(dataConnect)

  const memberships = viewerId ? data?.organizationUsers ?? [] : []

  /*
    The selection, resolved during render rather than synced into state.

    The persisted id is a preference; this list is the authority on what it can mean. An id
    naming an organization the reader has left, or one belonging to another account on this
    browser, matches nothing and falls through to the first membership. Nothing writes the stored
    value back, which is both why there is no state syncing effect here and why somebody
    re-invited to that organization later gets their old selection returned to them
  */
  const membership = memberships.find(({ organization }) => organization.id === organizationId)
    ?? memberships[0]
    ?? null

  /*
    True until the first answer lands, rather than whenever a request is in flight. The literal
    reading of `loading` in `~types` would be `isFetching`, and it would replace the page with a
    full screen spinner on the refetch that follows every create.

    `isError` releases it. A read this reader is not allowed to make is not going to start
    working, and a hang says less than an empty page does
  */
  const loading = Boolean(viewerId) && isPending && !isError

  async function refetch() {
    await refetchOrganizations()
  }

  /*
    Refetch first, select second. The other order selects an id the list does not hold yet, so the
    derivation above falls back to the previous first organization for one paint and the picker
    visibly jumps.

    This one throws where `updateUser` logs, because the caller has a form to keep: a create that
    failed must not clear the name somebody typed
  */
  async function createOrganization(name: string) {
    const { organization } = await createOrganizationMutation({ name })

    await refetchOrganizations()

    setOrganizationId(organization.id)
  }

  const contextValue: OrganizationContextType = {
    data: memberships,
    initialLoading: loading,
    loading,
    refetch,
    organization: membership?.organization ?? null,
    role: membership?.role ?? null,
    setOrganizationId,
    createOrganization,
  }

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  )
}

export default OrganizationProvider
