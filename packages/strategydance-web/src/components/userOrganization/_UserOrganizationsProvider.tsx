import { useQueryClient } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import type { ChangeOrganizationImageData, OrganizationImageKind } from 'strategydance-core'
import type { CompanyAspect, GetCurrentUserOrganizationsData } from 'strategydance-database/web'
import {
  useAcceptOrganizationInvitation,
  useAddOrganizationExploredAspect,
  useCreateOrganization,
  useGetCurrentUserOrganizations,
  useUpdateOrganization,
} from 'strategydance-database/web/react'

import type { UserOrganizationsContextType } from '~contexts/UserOrganizationsContext'

import UserOrganizationsContext from '~contexts/UserOrganizationsContext'

import useAuthentication from '~hooks/authentication/useAuthentication'

import { requestApi } from '~data/api'
import { dataConnect } from '~data/firebase'

/*
  Owns the reader's memberships: reads them, and creates one more when asked.

  Which of them is current is `_CurrentOrganizationProvider`, mounted below this one. Mounted in
  `Wrap` below `_UserProvider`, and like every provider there it renders its children
  unconditionally. `UserOrganizationsWait` is the half that gates
*/
function UserOrganizationsProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
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
  const { mutateAsync: addExploredAspectMutation } = useAddOrganizationExploredAspect(dataConnect)
  const { mutateAsync: acceptInvitationMutation } = useAcceptOrganizationInvitation(dataConnect)
  const { mutateAsync: updateOrganizationMutation } = useUpdateOrganization(dataConnect)

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

  /*
    Accepts an invitation, and resolves once the list holds the new membership, so the caller can
    select the organization knowing the sidebar has it.

    The read after the write throws on failure, which a refetch does not do by default: a caller
    told the membership is there when the list does not show it would switch to an organization
    the sidebar cannot find
  */
  async function joinOrganization(invitationId: string, organizationId: string) {
    await acceptInvitationMutation({ id: invitationId, organizationId })
    await refetchUserOrganizations({ throwOnError: true })
  }

  /*
    The database writes the list whole, so the new one is built here from the list last read. The
    server accepts it only as that list with the aspect appended, so a list that changed in
    between, another tab or member having added an aspect, is refused: the list is read again and
    the write tried again, up to three times. An aspect already there is left as it is, and the
    refetch before answering means the caller can navigate to the aspect knowing the sidebar lists
    it.

    Both refetches throw on failure, which a refetch does not do by default. A write followed by a
    failed read is then an attempt like any other, retried from a fresh read, rather than a success
    claimed on a list that does not show it
  */
  async function exploreCompanyAspect(organizationId: string, aspect: CompanyAspect) {
    let memberships = userOrganizations

    for (let attempt = 1; ; attempt++) {
      const exploredAspects = memberships.find(({ organization }) => organization.id === organizationId)?.organization.exploredAspects ?? []

      if (exploredAspects.includes(aspect)) return

      try {
        await addExploredAspectMutation({
          organizationId,
          aspect,
          exploredAspects: [...exploredAspects, aspect],
        })
        await refetchUserOrganizations({ throwOnError: true })

        return
      }
      catch (error) {
        if (attempt >= 3) throw error

        const { data: refetched } = await refetchUserOrganizations({ throwOnError: true })

        memberships = refetched?.userOrganizations ?? []
      }
    }
  }

  /*
    Renames an organization and sets its color, and resolves once the list shows both: the
    settings page compares its form to the list, so it reads as saved the moment this resolves,
    with no instant of the old values in between.

    The read after the write throws on failure, as `joinOrganization`'s does, and the write throws
    as `createOrganization`'s does, since the page keeps what was typed when either fails
  */
  async function updateOrganization(organizationId: string, name: string, color: string | null) {
    await updateOrganizationMutation({ organizationId, name, color })
    await refetchUserOrganizations({ throwOnError: true })
  }

  /*
    Makes a picture an organization's logo or banner, or removes it, through the backend: only an
    administrator may, which a Storage rule cannot check. Resolves once the list shows the new URL,
    so the settings page can drop its preview without the old picture flashing back in between
  */
  async function changeOrganizationImage(organizationId: string, kind: OrganizationImageKind, image: Blob | null) {
    await requestApi<ChangeOrganizationImageData>({
      method: image ? 'PUT' : 'DELETE',
      path: `/organizations/${organizationId}/${kind}`,
      body: image ?? undefined,
    })
    await refetchUserOrganizations({ throwOnError: true })
  }

  /*
    Takes an organization that was just deleted out of the list, then reads the list again.

    Out of the cached list first, so the current organization moves on at once and for sure: the
    read after it may fail, as a refetch does without a word, and the list must not keep offering
    an organization that is gone meanwhile. The read is what catches anything else that changed
  */
  async function forgetOrganization(organizationId: string) {
    queryClient.setQueryData<GetCurrentUserOrganizationsData>(['GetCurrentUserOrganizations', viewerId], cached => cached && {
      ...cached,
      userOrganizations: cached.userOrganizations.filter(({ organization }) => organization.id !== organizationId),
    })

    await refetchUserOrganizations()
  }

  const contextValue: UserOrganizationsContextType = {
    data: userOrganizations,
    initialLoading,
    loading,
    refetch,
    createOrganization,
    joinOrganization,
    exploreCompanyAspect,
    updateOrganization,
    changeOrganizationImage,
    forgetOrganization,
  }

  return (
    <UserOrganizationsContext.Provider value={contextValue}>
      {children}
    </UserOrganizationsContext.Provider>
  )
}

export default UserOrganizationsProvider
