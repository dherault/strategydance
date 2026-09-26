import type { PropsWithChildren } from 'react'
import { OrganizationRole } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import ContainerLayout from '~components/layout/ContainerLayout'
import OrganizationSettingsAdministratorsOnly from '~components/organizationSettings/OrganizationSettingsAdministratorsOnly'
import OrganizationSettingsHeader from '~components/organizationSettings/OrganizationSettingsHeader'
import OrganizationSettingsNoOrganization from '~components/organizationSettings/OrganizationSettingsNoOrganization'

/*
  Lets an administrator of the current organization through to its settings, and tells anybody
  else why there is nothing here for them, under the page's own header.

  Nothing to wait for: `UserOrganizationsWait` holds the whole authenticated area until the
  memberships, and the role with them, have arrived.

  The memberships are not live, so the team's live query is subscribed to here for what it does
  on the side: when a pushed team says the reader's role changed, it reads the memberships again.
  An administrator demoted while on this page is then turned away, and a member promoted is let
  in, without a reload. The team itself is never read
*/
function OrganizationSettingsBouncer({ children }: PropsWithChildren) {
  const { organization, role } = useCurrentOrganization()

  useOrganizationTeam()

  if (organization && role === OrganizationRole.ADMINISTRATOR) return children

  return (
    <ContainerLayout className="gap-8">
      <OrganizationSettingsHeader />
      {organization
        ? <OrganizationSettingsAdministratorsOnly organizationName={organization.name} />
        : <OrganizationSettingsNoOrganization />}
    </ContainerLayout>
  )
}

export default OrganizationSettingsBouncer
