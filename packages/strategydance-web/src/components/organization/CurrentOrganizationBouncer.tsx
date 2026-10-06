import type { PropsWithChildren } from 'react'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import OrganizationNotFound from '~components/organization/OrganizationNotFound'

/*
  Keeps an organization's pages to an organization the reader is in. Sits under
  `UserOrganizationsWait`, so the list it judges the path against has arrived, and a path naming
  none of it is the organization not found page, whether the organization was deleted, the reader
  was removed or never invited, or the slug was mistyped.

  The team's live query, kept open here, is what tells the app the reader was removed or the
  organization deleted while one of its pages is open: the memberships are read again, the path
  stops naming one of them, and this shows the page rather than whatever the organization's page
  can no longer read
*/
function CurrentOrganizationBouncer({ children }: PropsWithChildren) {
  const { organization, organizationSlug, isRouteOrganizationMissing } = useCurrentOrganization()

  useOrganizationTeam()

  if (isRouteOrganizationMissing) {
    return (
      <OrganizationNotFound
        fallback={
          organization && organizationSlug
            ? {
                organizationName: organization.name,
                link: { to: '/$organizationSlug/today', params: { organizationSlug } },
              }
            : null
        }
      />
    )
  }

  return children
}

export default CurrentOrganizationBouncer
