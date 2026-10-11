import { useMatch } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'
import { toOrganizationPathSegment } from 'strategydance-core'

import type { CurrentOrganizationContextType } from '~contexts/CurrentOrganizationContext'
import CurrentOrganizationContext from '~contexts/CurrentOrganizationContext'

import usePersistedState from '~hooks/common/usePersistedState'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

/*
  Owns the choice of organization, and nothing else. `_UserOrganizationsProvider` owns the list,
  and this one is mounted below it because resolving a choice means reading that list.

  Mounted in `InnerWrap` rather than `Wrap`, since it reads the path, and only `InnerWrap` is
  inside the router. It is above the document shell all the same, so like every provider there
  it renders its children unconditionally
*/
function CurrentOrganizationProvider({ children }: PropsWithChildren) {
  const { data: userOrganizations } = useUserOrganizations()

  /*
    The key stays a literal. A template carrying the uid looks like the fix for two accounts on
    one browser and is not: `usePersistedState` runs its initializer once, so signing into a
    second account in the same tab would keep the first one's choice under the second one's key.
    The derivation below is what actually handles that
  */
  const [organizationId, setOrganizationId] = usePersistedState<string | null>('organizationId', null)

  // The segment an organization's page's path leads with, and undefined on any other page
  const routeOrganizationSlug = useMatch({
    from: '/_authenticated/_app/$organizationSlug',
    shouldThrow: false,
    select: match => match.params.organizationSlug,
  })

  /*
    The choice, resolved during render rather than synced into state.

    On an organization's page the path decides, by its slug or by its id for an organization that
    has none yet. Anywhere else the persisted id is a preference, and the list is the authority on
    what it can mean. An id naming an organization the reader has left, or one belonging to
    another account on this browser, matches nothing and falls through to the first membership.
    So does a path naming an organization the reader is not in, which leaves the sidebar on one
    they are, beside the page saying so
  */
  const routeUserOrganization =
    routeOrganizationSlug === undefined
      ? undefined
      : userOrganizations.find(
          ({ organization }) =>
            organization.slug === routeOrganizationSlug || organization.id === routeOrganizationSlug,
        )
  const userOrganization =
    routeUserOrganization
    ?? userOrganizations.find(({ organization }) => organization.id === organizationId)
    ?? userOrganizations[0]
    ?? null

  const routeOrganizationId = routeUserOrganization?.organization.id ?? null

  /*
    An organization opened by its path is remembered as the one last had open, so the pages
    outside any organization, `/today` and the next visit follow it. Only one the path names is
    written: a fallback never is, which is why somebody re-invited to the organization they had
    open gets it back
  */
  useEffect(() => {
    if (routeOrganizationId && routeOrganizationId !== organizationId) setOrganizationId(routeOrganizationId)
  }, [routeOrganizationId, organizationId, setOrganizationId])

  const organization = userOrganization?.organization ?? null

  const contextValue: CurrentOrganizationContextType = {
    organization,
    role: userOrganization?.role ?? null,
    jobTitle: userOrganization?.jobTitle ?? null,
    organizationSlug: organization ? toOrganizationPathSegment(organization) : null,
    isRouteOrganizationMissing: routeOrganizationSlug !== undefined && !routeUserOrganization,
    setOrganizationId,
  }

  return <CurrentOrganizationContext.Provider value={contextValue}>{children}</CurrentOrganizationContext.Provider>
}

export default CurrentOrganizationProvider
