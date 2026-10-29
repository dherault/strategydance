import { useQuery } from '@tanstack/react-query'
import { executeQuery } from 'firebase/data-connect'
import { type GetDocumentRevisionsData, getDocumentRevisionsRef } from 'strategydance-database/web'

import useLiveQuerySubscription from '~hooks/common/useLiveQuerySubscription'

import { dataConnect } from '~data/firebase'

type DocumentRevision = GetDocumentRevisionsData['documentRevisions'][number]

const NONE: DocumentRevision[] = []

/*
  A document's history, the text it held before each of the agents' edits to it and before each
  restore, the newest first, kept live while it is open: every edit an agent makes, and every
  restore, pushes it again. Read through `useQuery` and `executeQuery` rather than the generated
  hook, as `useOrganizationTeam` explains. `hasFailed` tells a read that failed from a document
  nobody changed, and it does not retry on mount, as there
*/
function useDocumentRevisions({
  organizationId,
  documentId,
  isEnabled,
}: {
  organizationId: string
  documentId: string
  isEnabled: boolean
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['GetDocumentRevisions', organizationId, documentId],
    queryFn: async () => {
      const { data: revisions } = await executeQuery(
        getDocumentRevisionsRef(dataConnect, { organizationId, documentId }),
      )

      return revisions
    },
    enabled: isEnabled,
    retryOnMount: false,
  })

  useLiveQuerySubscription({
    name: 'document revisions',
    queryKey: isEnabled ? ['GetDocumentRevisions', organizationId, documentId] : null,
    createQueryRef: () => getDocumentRevisionsRef(dataConnect, { organizationId, documentId }),
  })

  return {
    revisions: data?.documentRevisions ?? NONE,
    isLoading: isEnabled && isPending && !isError,
    hasFailed: isEnabled && isError && data === undefined,
  }
}

export default useDocumentRevisions
