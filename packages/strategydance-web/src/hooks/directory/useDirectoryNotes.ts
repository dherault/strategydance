import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getDirectoryNotesRef } from 'strategydance-database/web'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  The current organization's notes on one directory, its blocks serialized, an empty string when it
  has none, kept live, so a dialog open while the agent writes them takes what it wrote. Read when
  the dialog opens, since the page's list reads only their plain text
*/
function useDirectoryNotes(directoryId: string) {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['GetDirectoryNotes', organizationId, directoryId],
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getDirectoryNotesRef(dataConnect, { organizationId: organizationId!, directoryId }),
      )

      return result
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'directory notes',
    queryKey: organizationId ? ['GetDirectoryNotes', organizationId, directoryId] : null,
    createQueryRef: () => getDirectoryNotesRef(dataConnect, { organizationId: organizationId!, directoryId }),
  })

  return {
    content: data ? (data.knowledgeNotes[0]?.content ?? '') : null,
    hasFailed: isError && data === undefined,
    isPending: Boolean(organizationId) && isPending && !isError,
    refetch: async () => {
      await refetch()
    },
  }
}

export default useDirectoryNotes
