import type { PropsWithChildren } from 'react'
import { OrganizationRole } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import ContainerLayout from '~components/layout/ContainerLayout'
import OrganizationProfileAdministratorsOnly from '~components/organizationProfile/OrganizationProfileAdministratorsOnly'
import OrganizationProfileHeader from '~components/organizationProfile/OrganizationProfileHeader'

/*
  Lets an administrator of the current organization through to its profile, and tells a member
  that only an administrator may edit it, under the page's own header. There is always a current
  organization here, since `_app`'s bouncer sends a reader with none to the prologue, so the check
  on it only narrows the type.

  Nothing to wait for: `UserOrganizationsWait` holds the whole authenticated area until the
  memberships, and the role with them, have arrived.

  The memberships are not live, so the team's live query is subscribed to here for what it does
  on the side: when a pushed team says the reader's role changed, it reads the memberships again.
  An administrator demoted while on this page is then turned away, and a member promoted is let
  in, without a reload. The team itself is never read
*/
function OrganizationProfileBouncer({ children }: PropsWithChildren) {
  const { organization, role } = useCurrentOrganization()

  useOrganizationTeam()

  if (organization && role === OrganizationRole.ADMINISTRATOR) return children

  return (
    <ContainerLayout className="gap-8">
      <OrganizationProfileHeader />
      {organization ? <OrganizationProfileAdministratorsOnly organizationName={organization.name} /> : null}
    </ContainerLayout>
  )
}

export default OrganizationProfileBouncer
