import { createFileRoute } from '@tanstack/react-router'

import AdministrationUsers from '~components/administration/AdministrationUsers'
import AdministrationUsersWait from '~components/administration/AdministrationUsersWait'

export const Route = createFileRoute('/_authenticated/_app/administration/users')({
  component: AdministrationUsersRoute,
})

function AdministrationUsersRoute() {
  return (
    <AdministrationUsersWait>
      <AdministrationUsers />
    </AdministrationUsersWait>
  )
}
