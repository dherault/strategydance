import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getTaskDescriptionRef } from 'strategydance-database/web'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  One task's description, for its dialog, kept live: a teammate's save shows here as it lands, and
  pushes this description alone. Undefined until the first read lands, or when it failed, where
  the dialog shows what the board read without letting it be edited; an empty string for a task
  with no description, or gone. A first read that fails says so through `hasFailed`, and `refetch`
  tries it again
*/
function useTaskDescription(taskId: string) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const queryKey = ['GetTaskDescription', organizationId, taskId]

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getTaskDescriptionRef(dataConnect, { organizationId: organizationId!, id: taskId }),
      )

      return result
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'task description',
    queryKey: organizationId ? queryKey : null,
    createQueryRef: () => getTaskDescriptionRef(dataConnect, { organizationId: organizationId!, id: taskId }),
  })

  return {
    data: data && (data.tasks[0]?.description ?? ''),
    hasFailed: Boolean(organizationId) && isError && data === undefined,
    isFetching,
    refetch: async () => {
      await refetch()
    },
  }
}

export default useTaskDescription
