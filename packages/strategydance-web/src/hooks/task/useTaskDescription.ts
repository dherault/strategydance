import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getTaskDescriptionRef } from 'strategydance-database/web'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'
import useIsTaskBeingCreated from '~hooks/task/useIsTaskBeingCreated'

import { dataConnect } from '~data/firebase'

/*
  One task's description, for its dialog, kept live: a teammate's save shows here as it lands, and
  pushes this description alone. Undefined until the first read lands, or when it failed, where
  the dialog shows what the board read without letting it be edited; an empty string for a task
  with no description, or gone. A first read that fails says so through `hasFailed`, and `refetch`
  tries it again.

  A task the reader just created is neither read nor subscribed to until the server has it, since
  the server would answer that it has no description, and leaves the dialog the description the
  board was given with it until then
*/
function useTaskDescription(taskId: string) {
  const { organization } = useCurrentOrganization()
  const isBeingCreated = useIsTaskBeingCreated(taskId)

  const organizationId = organization?.id ?? null
  const queryKey = ['GetTaskDescription', organizationId, taskId]
  const isEnabled = Boolean(organizationId) && !isBeingCreated

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getTaskDescriptionRef(dataConnect, { organizationId: organizationId!, id: taskId }),
      )

      return result
    },
    enabled: isEnabled,
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'task description',
    queryKey: isEnabled ? queryKey : null,
    createQueryRef: () => getTaskDescriptionRef(dataConnect, { organizationId: organizationId!, id: taskId }),
  })

  return {
    data: data && (data.tasks[0]?.description ?? ''),
    hasFailed: isEnabled && isError && data === undefined,
    isFetching,
    refetch: async () => {
      await refetch()
    },
  }
}

export default useTaskDescription
