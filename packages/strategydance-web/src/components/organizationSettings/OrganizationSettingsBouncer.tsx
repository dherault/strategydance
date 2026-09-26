import type { PropsWithChildren } from 'react'
import { OrganizationRole } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import ContainerLayout from '~components/layout/ContainerLayout'
import OrganizationSettingsAdministratorsOnly from '~components/organizationSettings/OrganizationSettingsAdministratorsOnly'
import OrganizationSettingsHeader from '~components/organizationSettings/OrganizationSettingsHeader'
import OrganizationSettingsNoOrganization from '~components/organizationSettings/OrganizationSettingsNoOrganization'

/*
  Lets an administrator of the current organization through to its settings, and tells anybody
  else why there is nothing here for them, under the page's own header.

  Nothing to wait for: `UserOrganizationsWait` holds the whole authenticated area until the
  memberships, and the role with them, have arrived. A role that changes while the page is open,
  the reader demoted by another administrator, turns the page into the notice
*/
function OrganizationSettingsBouncer({ children }: PropsWithChildren) {
  const { organization, role } = useCurrentOrganization()

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
