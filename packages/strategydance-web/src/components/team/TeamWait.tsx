import type { PropsWithChildren } from 'react'

import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import Loading from '~components/common/Loading'

/*
  Holds the team page until its first read lands. `initialLoading` rather than `loading`, since
  the live query writes over the data while somebody is looking at it, and a refetch on focus
  must not blank the page either
*/
function TeamWait({ children }: PropsWithChildren) {
  const { initialLoading } = useOrganizationTeam()

  if (initialLoading) {
    return (
      <Loading source="TeamWait" />
    )
  }

  return children
}

export default TeamWait
