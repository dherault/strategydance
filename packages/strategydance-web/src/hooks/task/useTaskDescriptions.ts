import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getTaskDescriptionsRef } from 'strategydance-database/web'

import type { DataSource } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  The descriptions of the current organization's tasks, by task id, kept live as `useTasks` keeps
  the board: the board searches them and a task's dialog shows its own. Apart from the board, so a
  card moved does not push every description to every member with the page open.

  A task with no row here yet, as one just added in another tab, reads as having no description
*/
function useTaskDescriptions(): DataSource<ReadonlyMap<string, string>> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetTaskDescriptions', organizationId],
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getTaskDescriptionsRef(dataConnect, { organizationId: organizationId! }),
      )

      return result
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'task descriptions',
    queryKey: organizationId ? ['GetTaskDescriptions', organizationId] : null,
    createQueryRef: () => getTaskDescriptionsRef(dataConnect, { organizationId: organizationId! }),
  })

  return {
    data: new Map((data?.tasks ?? []).map(task => [task.id, task.description])),
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useTaskDescriptions
