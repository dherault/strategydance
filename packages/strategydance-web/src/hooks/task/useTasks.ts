import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getTasksRef } from 'strategydance-database/web'

import type { DataSource, Task } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_TASKS: Task[] = []

/*
  The current organization's board, every task in its column's order, kept live: any member moving,
  editing or deleting a task moves it on every open board.

  As `useOrganizationTeam` does, the first read is an ordinary query, which `TaskBoardWait` waits
  on, and the subscription beside it writes each list the server pushes into the same cache entry,
  where `useTaskChanges` writes what the reader changes before the server has it. The descriptions
  are read apart, by `useTaskDescriptions`.

  A first read that fails is not an empty board: `hasFailed` says so, and it does not retry on
  mount, for the reason `useOrganizationTeam` gives
*/
function useTasks(): DataSource<Task[]> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetTasks', organizationId],
    queryFn: async () => {
      const { data: result } = await executeQuery(getTasksRef(dataConnect, { organizationId: organizationId! }))

      return result
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'tasks',
    queryKey: organizationId ? ['GetTasks', organizationId] : null,
    createQueryRef: () => getTasksRef(dataConnect, { organizationId: organizationId! }),
  })

  return {
    data: data?.tasks ?? EMPTY_TASKS,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useTasks
