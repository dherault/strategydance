import type { PropsWithChildren } from 'react'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useChecklist from '~hooks/checklist/useChecklist'
import useLocalDate from '~hooks/common/useLocalDate'
import useOrganizationLogWeek from '~hooks/log/useOrganizationLogWeek'
import useActiveTaskListId from '~hooks/task/useActiveTaskListId'
import useTaskLists from '~hooks/task/useTaskLists'
import useTasks from '~hooks/task/useTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'
import useTodayPreferences from '~hooks/today/useTodayPreferences'

import addDays from '~utils/date/addDays'

import Loading from '~components/common/Loading'

/*
  Holds the Today page until its first reads land. Every read the page opens with is started here
  at once, so they fetch side by side rather than one section after another, and the page appears
  whole. The open list's tasks are read for the list the reader last opened, so they need not wait
  for the lists either.

  Every key waited on here holds still for as long as the page is mounted: the organization's, the
  reader's own checklist, and the remembered list as it was on arrival, since this component never
  changes it. A key that moved as the reader worked, the first list once they add one, would be a
  query with nothing cached, and the page would be swapped for the spinner and mounted anew under
  their cursor. With no list remembered, the open list's tasks load inside the section instead. The
  log's newest week does move, at midnight, but keeps the day before on screen while the new one is
  read, so it never counts as loading again.

  `initialLoading` rather than `loading`, since the live queries write over their data while
  somebody is looking at it, and a refetch on focus must not blank the page either
*/
function TodayWait({ children }: PropsWithChildren) {
  const { initialLoading: isTeamLoading } = useOrganizationTeam()
  const { initialLoading: arePreferencesLoading } = useTodayPreferences()
  const { initialLoading: areTaskListsLoading } = useTaskLists()
  const [activeTaskListId] = useActiveTaskListId()
  const { initialLoading: areTasksLoading } = useTasks(activeTaskListId)
  const { data: viewer } = useAuthentication()
  const { initialLoading: isChecklistLoading } = useChecklist(viewer?.uid ?? null)
  const today = useLocalDate()
  const { initialLoading: isLogLoading } = useOrganizationLogWeek({ from: addDays(today, -6), to: today, isLive: true })

  if (isTeamLoading || arePreferencesLoading || areTaskListsLoading || areTasksLoading || isChecklistLoading || isLogLoading) {
    return (
      <Loading source="TodayWait" />
    )
  }

  return children
}

export default TodayWait
