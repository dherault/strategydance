import type { PropsWithChildren } from 'react'

import useOrganizationTeam from '~hooks/team/useOrganizationTeam'
import useTodayPreferences from '~hooks/today/useTodayPreferences'

import Loading from '~components/common/Loading'

/*
  Holds the Today page until its first reads land. Every read the page opens with is started here
  at once, so they fetch side by side rather than one section after another, and the page appears
  whole. `initialLoading` rather than `loading`, since the live queries write over their data
  while somebody is looking at it, and a refetch on focus must not blank the page either
*/
function TodayWait({ children }: PropsWithChildren) {
  const { initialLoading: isTeamLoading } = useOrganizationTeam()
  const { initialLoading: arePreferencesLoading } = useTodayPreferences()

  if (isTeamLoading || arePreferencesLoading) {
    return (
      <Loading source="TodayWait" />
    )
  }

  return children
}

export default TodayWait
