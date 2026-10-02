import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getOrganizationDocumentsRef } from 'strategydance-database/web'

import type { DataSource, KnowledgeDocumentSummary } from '~types'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

const EMPTY_DOCUMENTS: KnowledgeDocumentSummary[] = []

/*
  The current organization's knowledge, the latest changed first, kept live: the Knowledge page
  and each aspect's page read the same list, and the aspect's page filters it.

  As `useOrganizationTeam` does, the first read is an ordinary query, which
  `KnowledgeDocumentsWait` waits on, and the subscription beside it writes each list the server
  pushes into the same cache entry. A save of a document's content pushes nothing, so the list
  is read again whenever a page with it mounts, which is how a card's "Edited" catches up.

  A first read that fails is not an empty list: `hasFailed` says so, and it does not retry on
  mount, for the reason `useOrganizationTeam` gives
*/
function useOrganizationKnowledgeDocuments(): DataSource<KnowledgeDocumentSummary[]> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetOrganizationDocuments', organizationId],
    queryFn: async () => {
      const { data: result } = await executeQuery(
        getOrganizationDocumentsRef(dataConnect, { organizationId: organizationId! }),
      )

      return result
    },
    enabled: Boolean(organizationId),
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'knowledge',
    queryKey: organizationId ? ['GetOrganizationDocuments', organizationId] : null,
    createQueryRef: () => getOrganizationDocumentsRef(dataConnect, { organizationId: organizationId! }),
  })

  return {
    data: data?.documents ?? EMPTY_DOCUMENTS,
    initialLoading: Boolean(organizationId) && isPending && !isError,
    loading: Boolean(organizationId) && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: Boolean(organizationId) && isError && data === undefined,
  }
}

export default useOrganizationKnowledgeDocuments
