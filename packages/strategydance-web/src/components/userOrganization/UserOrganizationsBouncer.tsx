import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

/*
  Keeps the app to somebody who belongs to an organization, and sends anybody else to the
  prologue to create one. Sits under `UserOrganizationsWait`, so an empty list means none rather
  than not read yet. The mirror of `OnboardingBouncer`.

  Below it, `useCurrentOrganization()` always has an organization to resolve to. Somebody whose
  last organization goes, deleted or removed from under them, is sent on from here as soon as the
  list drops it.

  An effect rather than a `<Navigate>`, as in `AuthenticationBouncer`
*/
function UserOrganizationsBouncer({ children }: PropsWithChildren) {
  const { data: userOrganizations } = useUserOrganizations()
  const navigate = useNavigate()

  const hasOrganization = userOrganizations.length > 0

  useEffect(() => {
    if (hasOrganization) return

    navigate({ to: '/prologue', replace: true })
  }, [
    hasOrganization,
    navigate,
  ])

  if (!hasOrganization) return null

  return children
}

export default UserOrganizationsBouncer
