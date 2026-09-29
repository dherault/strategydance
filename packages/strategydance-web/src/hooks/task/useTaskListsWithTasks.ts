import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getTaskListsWithTasksRef } from 'strategydance-database/web'

import type { DataSource, TaskListWithTasks } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_TASK_LISTS: TaskListWithTasks[] = []

/*
  The reader's own task lists in the current organization, each with all of its tasks, read only,
  for the build in public page, whose cards count and list tasks across lists. The Today page reads
  one list at a time instead, through `useTasks`.

  It does not retry on mount, and a failed read is `hasFailed` rather than no lists:
  `BuildInPublicWait` waits on it
*/
function useTaskListsWithTasks(): DataSource<TaskListWithTasks[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    // The key names whose lists they are, as `useTaskLists`' does
    queryKey: ['GetTaskListsWithTasks', organizationId, viewerId],
    queryFn: async () => {
      const { data: taskLists } = await executeQuery(
        getTaskListsWithTasksRef(dataConnect, { organizationId: organizationId! }),
      )

      return taskLists.taskLists
    },
    enabled: isEnabled,
    retryOnMount: false,
  })

  return {
    data: data ?? EMPTY_TASK_LISTS,
    initialLoading: isEnabled && isPending && !isError,
    loading: isEnabled && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useTaskListsWithTasks
