import type { PropsWithChildren } from 'react'

import { BUILD_IN_PUBLIC_LOG_DAYS } from '~constants'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useActivityDays from '~hooks/buildInPublic/useActivityDays'
import useChecklist from '~hooks/checklist/useChecklist'
import useChecklistHistory from '~hooks/checklist/useChecklistHistory'
import useLocalDate from '~hooks/common/useLocalDate'
import useOrganizationLogWeek from '~hooks/log/useOrganizationLogWeek'
import useTaskListsWithTasks from '~hooks/task/useTaskListsWithTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import addDays from '~utils/date/addDays'

import Loading from '~components/common/Loading'

/*
  Holds the build in public page until its first reads land, every one started here at once, so
  they fetch side by side and the page appears whole. `initialLoading` rather than `loading`, so a
  refetch on focus does not blank the page
*/
function BuildInPublicWait({ children }: PropsWithChildren) {
  const { initialLoading: areActivityDaysLoading } = useActivityDays()
  const { initialLoading: isTeamLoading } = useOrganizationTeam()
  const { initialLoading: areTaskListsLoading } = useTaskListsWithTasks()
  const { data: viewer } = useAuthentication()
  const viewerId = viewer?.uid ?? null
  const { initialLoading: isChecklistLoading } = useChecklist(viewerId)
  const { isLoading: isChecklistHistoryLoading } = useChecklistHistory(viewerId, true)
  const today = useLocalDate()
  const { initialLoading: isLogLoading } = useOrganizationLogWeek({
    from: addDays(today, -(BUILD_IN_PUBLIC_LOG_DAYS - 1)),
    to: today,
    isLive: false,
  })

  if (
    areActivityDaysLoading
    || isTeamLoading
    || areTaskListsLoading
    || isChecklistLoading
    || isChecklistHistoryLoading
    || isLogLoading
  ) {
    return <Loading source="BuildInPublicWait" />
  }

  return children
}

export default BuildInPublicWait
