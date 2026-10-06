import { useNavigate, useRouter } from '@tanstack/react-router'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import buildOrganizationSwitchPath from '~utils/organization/buildOrganizationSwitchPath'
import toOrganizationPathSegment from '~utils/organization/toOrganizationPathSegment'

// The route every organization's page sits under
const ORGANIZATION_ROUTE_ID = '/_authenticated/_app/$organizationSlug'

/*
  Makes another organization the current one. On an organization's page that is a navigation, to
  the same page in the other one, since the path is what says which is current. On a page outside
  any organization, the reader's account or the administration, it is only remembered, which the
  sidebar follows and the next organization's page opened starts from.

  The location is read off the router when it is called, rather than subscribed to
*/
function useSwitchOrganization() {
  const { setOrganizationId } = useCurrentOrganization()
  const router = useRouter()
  const navigate = useNavigate()

  return function switchOrganization(organization: { id: string; slug?: string | null }) {
    setOrganizationId(organization.id)

    const { matches, location } = router.state

    if (!matches.some(({ routeId }) => routeId === ORGANIZATION_ROUTE_ID)) return

    navigate({ href: buildOrganizationSwitchPath(location.pathname, toOrganizationPathSegment(organization)) })
  }
}

export default useSwitchOrganization
