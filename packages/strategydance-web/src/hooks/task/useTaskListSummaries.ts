import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getTaskListSummariesRef } from 'strategydance-database/web'

import type { DataSource, TaskListSummary } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_TASK_LISTS: TaskListSummary[] = []

/*
  The reader's own task lists in the current organization as the build in public page draws them:
  how many tasks each holds and how many are done, and the few tasks its cards list. The Today page
  reads every task of one list at a time instead, through `useTasks`.

  It does not retry on mount, and a failed read is `hasFailed` rather than no lists:
  `BuildInPublicWait` waits on it
*/
function useTaskListSummaries(): DataSource<TaskListSummary[]> & { hasFailed: boolean } {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const viewerId = viewer?.uid ?? null
  const organizationId = organization?.id ?? null
  const isEnabled = Boolean(organizationId && viewerId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    // The key names whose lists they are, as `useTaskLists`' does
    queryKey: ['GetTaskListSummaries', organizationId, viewerId],
    queryFn: async () => {
      const { data: summaries } = await executeQuery(
        getTaskListSummariesRef(dataConnect, { organizationId: organizationId! }),
      )

      return summaries.taskLists
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

export default useTaskListSummaries
