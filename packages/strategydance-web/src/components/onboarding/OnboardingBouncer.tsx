import { useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useEffect } from 'react'

import useUserOrganizations from '~hooks/userOrganization/useUserOrganizations'

/*
  Keeps the onboarding to somebody who belongs to no organization, and sends anybody else on to
  today. Sits under `UserOrganizationsWait`, so an empty list means none rather than not read yet.

  It is also what ends the onboarding: creating the company refetches the memberships, and the
  first one arriving sends the reader on from here.

  An effect rather than a `<Navigate>`, as in `AuthenticationBouncer`
*/
function OnboardingBouncer({ children }: PropsWithChildren) {
  const { data: userOrganizations } = useUserOrganizations()
  const navigate = useNavigate()

  const hasOrganization = userOrganizations.length > 0

  useEffect(() => {
    if (!hasOrganization) return

    navigate({ to: '/-/today', replace: true })
  }, [
    hasOrganization,
    navigate,
  ])

  if (hasOrganization) return null

  return children
}

export default OnboardingBouncer
