import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getTaskDescriptionsRef } from 'strategydance-database/web'

import type { DataSource } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  The descriptions of the current organization's tasks, by task id, for the board's search. Read
  rather than kept live, so a save pushes no description to every open board: a task's dialog keeps
  its own live through `useTaskDescription`, the reader's own saves land here at once, and a
  teammate's do when the page is opened again or the tab comes back into focus.

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
