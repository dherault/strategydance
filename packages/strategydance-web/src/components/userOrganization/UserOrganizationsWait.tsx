import type { PropsWithChildren } from 'react'

import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import Loading from '~components/common/Loading'

/*
  Sits below `UserWait`, which is the order that makes this one simple: by the time it renders
  the reader's row exists, so the only thing left to wait on is the list of memberships.

  It waits for the list to arrive, not for it to have anything in it. A fresh account belongs to
  no organization and the page below is where they create their first one, so gating on an empty
  list would be a spinner with nothing behind it.

  `initialLoading` rather than `loading`, unlike the two waiters above it: this one sits over data
  that is refetched while somebody is looking at it, and gating on `loading` would replace the
  page with a spinner every time they create an organization
*/
function UserOrganizationsWait({ children }: PropsWithChildren) {
  const { initialLoading } = useUserOrganizations()

  if (initialLoading) {
    return (
      <Loading source="UserOrganizationsWait" />
    )
  }

  return children
}

export default UserOrganizationsWait
