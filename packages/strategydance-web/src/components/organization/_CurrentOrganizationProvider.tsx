import type { PropsWithChildren } from 'react'

import type { CurrentOrganizationContextType } from '~contexts/CurrentOrganizationContext'

import CurrentOrganizationContext from '~contexts/CurrentOrganizationContext'

import usePersistedState from '~hooks/common/usePersistedState'
import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

/*
  Owns the choice of organization, and nothing else. `_UserOrganizationsProvider` owns the list,
  and this one is mounted below it because resolving a choice means reading that list.

  Like every provider in `Wrap` it renders its children unconditionally
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

  /*
    The choice, resolved during render rather than synced into state.

    The persisted id is a preference; the list is the authority on what it can mean. An id naming
    an organization the reader has left, or one belonging to another account on this browser,
    matches nothing and falls through to the first membership. Nothing writes the stored value
    back, which is both why there is no state syncing effect here and why somebody re-invited to
    that organization later gets their old choice returned to them
  */
  const userOrganization = userOrganizations.find(({ organization }) => organization.id === organizationId)
    ?? userOrganizations[0]
    ?? null

  const contextValue: CurrentOrganizationContextType = {
    organization: userOrganization?.organization ?? null,
    role: userOrganization?.role ?? null,
    setOrganizationId,
  }

  return (
    <CurrentOrganizationContext.Provider value={contextValue}>
      {children}
    </CurrentOrganizationContext.Provider>
  )
}

export default CurrentOrganizationProvider
