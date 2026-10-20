import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { getDocumentRevisionContentRef } from 'strategydance-database/web'

import { dataConnect } from '~data/firebase'

/*
  The text a revision of a document keeps, as BlockNote's blocks, serialized, read once when a
  member opens it in the history, and never again: what a revision keeps never changes. Null when
  it is gone, pruned past its days or with its document
*/
function useDocumentRevisionContent({ organizationId, revisionId }: { organizationId: string; revisionId: string }) {
  return useQuery({
    queryKey: ['GetDocumentRevisionContent', organizationId, revisionId],
    queryFn: async () => {
      const { data } = await executeQuery(
        getDocumentRevisionContentRef(dataConnect, { organizationId, id: revisionId }),
      )

      return data.documentRevisions[0]?.content ?? null
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export default useDocumentRevisionContent
