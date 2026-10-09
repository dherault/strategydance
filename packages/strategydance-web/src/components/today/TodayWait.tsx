import type { PropsWithChildren } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useChecklist from '~hooks/checklist/useChecklist'
import useLocalDate from '~hooks/common/useLocalDate'
import useOrganizationLogWeek from '~hooks/log/useOrganizationLogWeek'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'
import useTodayPreferences from '~hooks/today/useTodayPreferences'

import addDays from '~utils/date/addDays'

import Loading from '~components/common/Loading'

/*
  Holds the Today page until its first reads land. Every read the page opens with is started here
  at once, so they fetch side by side rather than one section after another, and the page appears
  whole.

  Every key waited on here holds still for as long as the page is mounted: the organization's and
  the reader's own checklist. A key that moved as the reader worked would be a query with nothing
  cached, and the page would be swapped for the spinner and mounted anew under their cursor. The
  log's newest week does move, at midnight, but keeps the day before on screen while the new one is
  read, so it never counts as loading again.

  `initialLoading` rather than `loading`, since the live queries write over their data while
  somebody is looking at it, and a refetch on focus must not blank the page either
*/
function TodayWait({ children }: PropsWithChildren) {
  const { initialLoading: isTeamLoading } = useOrganizationTeam()
  const { data: viewer } = useAuthentication()
  const viewerId = viewer?.uid ?? null
  const { initialLoading: arePreferencesLoading } = useTodayPreferences()
  const { initialLoading: isChecklistLoading } = useChecklist(viewerId)
  const today = useLocalDate()
  const { initialLoading: isLogLoading } = useOrganizationLogWeek({ from: addDays(today, -6), to: today, isLive: true })

  if (isTeamLoading || arePreferencesLoading || isChecklistLoading || isLogLoading) {
    return <Loading source="TodayWait" />
  }

  return children
}

export default TodayWait
