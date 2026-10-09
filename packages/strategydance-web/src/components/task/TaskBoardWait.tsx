import type { PropsWithChildren } from 'react'

import useTaskDescriptions from '~hooks/task/useTaskDescriptions'
import useTasks from '~hooks/task/useTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

import Loading from '~components/common/Loading'

/*
  Holds the Tasks page until its first reads land, the board, its descriptions and the team whose
  names and pictures the cards draw, started here at once so they fetch side by side. The team's
  live query is what tells the app the reader was removed or the organization deleted, which moves
  them on. `initialLoading` rather than `loading`, since the live queries write over the board
  while somebody is looking at it
*/
function TaskBoardWait({ children }: PropsWithChildren) {
  const { initialLoading: areTasksLoading } = useTasks()
  const { initialLoading: areDescriptionsLoading } = useTaskDescriptions()
  const { initialLoading: isTeamLoading } = useOrganizationTeam()

  if (areTasksLoading || areDescriptionsLoading || isTeamLoading) {
    return <Loading source="TaskBoardWait" />
  }

  return children
}

export default TaskBoardWait
