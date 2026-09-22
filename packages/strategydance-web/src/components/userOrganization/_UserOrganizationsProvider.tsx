import type { PropsWithChildren } from 'react'
import { useCreateOrganization, useGetCurrentUserOrganizations } from 'strategydance-database/web/react'

import type { UserOrganizationsContextType } from '~contexts/UserOrganizationsContext'

import UserOrganizationsContext from '~contexts/UserOrganizationsContext'

import useAuthentication from '~hooks/authentication/useAuthentication'

import { dataConnect } from '~data/firebase'

/*
  Owns the reader's memberships: reads them, and creates one more when asked.

  Which of them is current is `_CurrentOrganizationProvider`, mounted below this one. Mounted in
  `Wrap` below `_UserProvider`, and like every provider there it renders its children
  unconditionally. `UserOrganizationsWait` is the half that gates
*/
function UserOrganizationsProvider({ children }: PropsWithChildren) {
  const { data: viewer } = useAuthentication()

  const viewerId = viewer?.uid ?? null

  /*
    The query key carries the uid, so signing into a second account on the same tab does not read
    the first one's list out of the cache while the new request is in flight.

    `enabled` keeps it from running for a signed out reader, whose token the `@auth(level: USER)`
    operation would refuse anyway
  */
  const { data, isPending, isFetching, isError, refetch: refetchUserOrganizations } = useGetCurrentUserOrganizations(dataConnect, {
    queryKey: ['GetCurrentUserOrganizations', viewerId],
    enabled: Boolean(viewerId),
  })

  const { mutateAsync: createOrganizationMutation } = useCreateOrganization(dataConnect)

  const userOrganizations = viewerId ? data?.userOrganizations ?? [] : []

  /*
    The two halves of `DataSource` mean different things, so they are read off different flags:
    `initialLoading` is true until the first answer lands, `loading` whenever a request is in
    flight, the refetch after a create included.

    `UserOrganizationsWait` reads `initialLoading` rather than `loading` for that last reason.
    Gating on `loading` would replace the page with a full screen spinner every time somebody
    creates an organization, which is the case `initialLoading` exists for.

    `isError` releases the first one. A read this reader is not allowed to make is not going to
    start working, and a hang says less than an empty page does
  */
  const initialLoading = Boolean(viewerId) && isPending && !isError
  const loading = Boolean(viewerId) && isFetching

  async function refetch() {
    await refetchUserOrganizations()
  }

  /*
    Refetches before answering, so the id it returns names a row a caller can already find in
    `data`. Selecting it is the caller's to do: this provider does not know what is selected.

    This one throws where `updateUser` logs, because the caller has a form to keep: a create that
    failed must not clear the name somebody typed
  */
  async function createOrganization(name: string) {
    const { organization } = await createOrganizationMutation({ name })

    await refetchUserOrganizations()

    return organization.id
  }

  const contextValue: UserOrganizationsContextType = {
    data: userOrganizations,
    initialLoading,
    loading,
    refetch,
    createOrganization,
  }

  return (
    <UserOrganizationsContext.Provider value={contextValue}>
      {children}
    </UserOrganizationsContext.Provider>
  )
}

export default UserOrganizationsProvider
