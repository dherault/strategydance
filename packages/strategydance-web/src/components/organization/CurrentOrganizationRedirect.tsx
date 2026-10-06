import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

/*
  Sends the reader on to the today of the organization they last had open, or their first. Under
  the app's layout, whose bouncer has already sent anybody in no organization to the prologue, so
  there is one to go to.

  An effect on the verdict rather than a `<Navigate>`, as `AuthenticationBouncer` explains
*/
function CurrentOrganizationRedirect() {
  const { organizationSlug } = useCurrentOrganization()
  const navigate = useNavigate()

  useEffect(() => {
    if (organizationSlug) navigate({ to: '/$organizationSlug/today', params: { organizationSlug }, replace: true })
  }, [organizationSlug, navigate])

  return null
}

export default CurrentOrganizationRedirect
