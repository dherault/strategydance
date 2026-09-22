import type { PropsWithChildren } from 'react'

import useOrganization from '~hooks/organization/useOrganization'

import Loading from '~components/common/Loading'

/*
  Sits below `UserWait`, which is the order that makes this one simple: by the time it renders
  the reader's row exists, so the only thing left to wait on is the list of memberships.

  It waits for the list to arrive, not for it to have anything in it. A fresh account belongs to
  no organization and the page below is where they create their first one, so gating on an empty
  list would be a spinner with nothing behind it
*/
function OrganizationsWait({ children }: PropsWithChildren) {
  const { loading } = useOrganization()

  if (loading) {
    return (
      <Loading source="OrganizationsWait" />
    )
  }

  return children
}

export default OrganizationsWait
