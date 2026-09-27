import { createFileRoute } from '@tanstack/react-router'

import AdministrationOrganizations from '~components/administration/AdministrationOrganizations'
import AdministrationOrganizationsWait from '~components/administration/AdministrationOrganizationsWait'

export const Route = createFileRoute('/_authenticated/_app/administration/organizations')({
  component: AdministrationOrganizationsRoute,
})

function AdministrationOrganizationsRoute() {
  return (
    <AdministrationOrganizationsWait>
      <AdministrationOrganizations />
    </AdministrationOrganizationsWait>
  )
}
