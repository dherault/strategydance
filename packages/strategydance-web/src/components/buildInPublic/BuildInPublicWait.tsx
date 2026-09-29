import type { PropsWithChildren } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useActivityDays from '~hooks/buildInPublic/useActivityDays'
import useChecklist from '~hooks/checklist/useChecklist'
import useChecklistHistory from '~hooks/checklist/useChecklistHistory'
import useLatestLogEntries from '~hooks/log/useLatestLogEntries'
import useTaskListsWithTasks from '~hooks/task/useTaskListsWithTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

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
  const { initialLoading: isLogLoading } = useLatestLogEntries()

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
