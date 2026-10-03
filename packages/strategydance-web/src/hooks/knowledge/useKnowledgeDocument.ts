import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getDocumentRef } from 'strategydance-database/web'

import type { DataSource, KnowledgeDocument } from '~types'

import isKnowledgeDocumentId from '~utils/knowledge/isKnowledgeDocumentId'

import { dataConnect } from '~data/firebase'

type Options = {
  // The organization the page opened in, which it keeps when the sidebar switches to another
  organizationId: string
  documentId: string
  // False for a draft, which is not stored yet and has nothing to read
  isEnabled: boolean
}

/*
  One document of an organization's knowledge, whole, or null when there is no such
  document: deleted, in another organization, or an id that is not one, which is answered here
  rather than sent to a server that would only refuse it.

  Read once per visit: its snapshot and the updates pending beside it start the page's text, and
  `GetLiveDocument` tells the page of every change after, so the answer must never change under
  it. Nothing marks it stale, a return to the tab does not read it again, and it is dropped from
  the cache the moment the page goes, so the next visit reads what is stored then rather than
  opening on a copy from before somebody's edits.

  A read that fails is not a missing document: `hasFailed` lets the page offer to try again, and
  it does not retry on mount, for the reason `useOrganizationTeam` gives
*/
function useKnowledgeDocument({
  organizationId,
  documentId,
  isEnabled,
}: Options): DataSource<KnowledgeDocument | null> & { hasFailed: boolean } {
  const isReadable = isEnabled

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetDocument', organizationId, documentId],
    queryFn: async () => {
      if (!isKnowledgeDocumentId(documentId)) return null

      const { data: result } = await executeQuery(getDocumentRef(dataConnect, { organizationId, id: documentId }))

      return result.documents[0] ?? null
    },
    enabled: isReadable,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retryOnMount: false,
  })

  return {
    data: data ?? null,
    initialLoading: isReadable && isPending && !isError,
    loading: isReadable && isFetching,
    refetch: async () => {
      await refetch()
    },
    hasFailed: isReadable && isError && data === undefined,
  }
}

export default useKnowledgeDocument
