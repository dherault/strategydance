import type { PropsWithChildren } from 'react'

import useAdministrationOrganizations from '~hooks/administration/useAdministrationOrganizations'

import Loading from '~components/common/Loading'

/*
  Holds the organizations page until its first read lands. `initialLoading` rather than
  `loading`, since the list is read again on focus, and that must not blank the page
*/
function AdministrationOrganizationsWait({ children }: PropsWithChildren) {
  const { initialLoading } = useAdministrationOrganizations()

  if (initialLoading) {
    return <Loading source="AdministrationOrganizationsWait" />
  }

  return children
}

export default AdministrationOrganizationsWait
