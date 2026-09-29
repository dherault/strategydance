import type { PropsWithChildren } from 'react'

import useAdministrationUsers from '~hooks/administration/useAdministrationUsers'

import Loading from '~components/common/Loading'

/*
  Holds the users page until its first read lands. `initialLoading` rather than `loading`, since
  the list is read again on focus, and that must not blank the page
*/
function AdministrationUsersWait({ children }: PropsWithChildren) {
  const { initialLoading } = useAdministrationUsers()

  if (initialLoading) {
    return <Loading source="AdministrationUsersWait" />
  }

  return children
}

export default AdministrationUsersWait
