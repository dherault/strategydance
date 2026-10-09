import useTaskDescriptions from '~hooks/task/useTaskDescriptions'
import useTasks from '~hooks/task/useTasks'
import useOrganizationTeam from '~hooks/team/useOrganizationTeam'

/*
  Whether the board can be trusted: its tasks, their descriptions and the team whose names the
  cards draw are read apart, and any of them failing fails the board. A description read as empty
  would otherwise be written over the real one by the next save, and a team read as empty would
  draw nobody on the cards. Trying again reads again whichever failed
*/
function useTaskBoardReads() {
  const { loading: areTasksLoading, refetch: refetchTasks, hasFailed: haveTasksFailed } = useTasks()
  const {
    loading: areDescriptionsLoading,
    refetch: refetchDescriptions,
    hasFailed: haveDescriptionsFailed,
  } = useTaskDescriptions()
  const { loading: isTeamLoading, refetch: refetchTeam, hasFailed: hasTeamFailed } = useOrganizationTeam()

  return {
    hasFailed: haveTasksFailed || haveDescriptionsFailed || hasTeamFailed,
    isRetrying: areTasksLoading || areDescriptionsLoading || isTeamLoading,
    retry: async () => {
      await Promise.all([
        haveTasksFailed ? refetchTasks() : undefined,
        haveDescriptionsFailed ? refetchDescriptions() : undefined,
        hasTeamFailed ? refetchTeam() : undefined,
      ])
    },
  }
}

export default useTaskBoardReads
