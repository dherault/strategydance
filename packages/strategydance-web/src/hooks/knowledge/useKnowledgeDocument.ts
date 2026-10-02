import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getDocumentRef } from 'strategydance-database/web'

import type { DataSource, KnowledgeDocument } from '~types'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import isKnowledgeDocumentId from '~utils/knowledge/isKnowledgeDocumentId'

import { dataConnect } from '~data/firebase'

type Options = {
  // False for a draft, which is not stored yet and has nothing to read
  isEnabled: boolean
}

/*
  One document of the current organization's knowledge, whole, or null when there is no such
  document: deleted, in another organization, or an id that is not one, which is answered here
  rather than sent to a server that would only refuse it.

  Read once per visit. The page seeds its editor from it and takes nothing in afterwards, so the
  answer must never change under it: nothing marks it stale, a return to the tab does not read it
  again, and it is dropped from the cache the moment the page goes, so the next visit reads what
  is stored then rather than opening an editor on a copy from before somebody's edits.

  A read that fails is not a missing document: `hasFailed` lets the page offer to try again, and
  it does not retry on mount, for the reason `useOrganizationTeam` gives
*/
function useKnowledgeDocument(
  documentId: string,
  { isEnabled }: Options,
): DataSource<KnowledgeDocument | null> & { hasFailed: boolean } {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null
  const isReadable = isEnabled && Boolean(organizationId)

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['GetDocument', organizationId, documentId],
    queryFn: async () => {
      if (!isKnowledgeDocumentId(documentId)) return null

      const { data: result } = await executeQuery(
        getDocumentRef(dataConnect, { organizationId: organizationId!, id: documentId }),
      )

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
