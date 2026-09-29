import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

import UserOrganizationsLoadFailed from '~components/userOrganization/UserOrganizationsLoadFailed'

/*
  Keeps the app to somebody who belongs to an organization, and sends anybody else to the
  prologue to create one. Sits under `UserOrganizationsWait`, so an empty list means none rather
  than not read yet, unless the read failed: then it offers to try again, since a member sent to
  the prologue would be offered a second company. The mirror of `OnboardingBouncer`.

  Below it, `useCurrentOrganization()` always has an organization to resolve to. Somebody whose
  last organization goes, deleted or removed from under them, is sent on from here as soon as the
  list drops it.

  An effect rather than a `<Navigate>`, as in `AuthenticationBouncer`
*/
function UserOrganizationsBouncer({ children }: PropsWithChildren) {
  const { data: userOrganizations, loading, refetch, hasFailed } = useUserOrganizations()
  const navigate = useNavigate()

  const hasOrganization = userOrganizations.length > 0

  useEffect(() => {
    if (hasFailed || hasOrganization) return

    navigate({ to: '/prologue', replace: true })
  }, [hasFailed, hasOrganization, navigate])

  if (hasFailed) {
    return (
      <UserOrganizationsLoadFailed
        isRetrying={loading}
        onRetry={refetch}
      />
    )
  }

  if (!hasOrganization) return null

  return children
}

export default UserOrganizationsBouncer
