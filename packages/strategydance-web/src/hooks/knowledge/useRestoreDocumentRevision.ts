import { useQueryClient } from '@tanstack/react-query'
import type { RestoreDocumentRevisionData } from 'strategydance-core'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { requestApi } from '~data/api'

/*
  Goes back to a version of one of the organization's documents through the backend, which writes
  it back as a new edit, merged with whatever is typed meanwhile: an Undo of one edit, which goes
  back only while nobody has written since, or a restore from the history, which takes what was
  written since with it. Answers the revision the restore kept, for an Undo of the restore, or null
  when the text read as the version already. Every thread's Undo is read again after, since the
  document's text moved. A refusal throws its `ApiError`
*/
function useRestoreDocumentRevision() {
  const queryClient = useQueryClient()
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  async function restore({
    documentId,
    revisionId,
    isUndo,
  }: {
    documentId: string
    revisionId: string
    isUndo: boolean
  }) {
    if (!organizationId) throw new Error('No current organization to restore a document in')

    try {
      const data = await requestApi<RestoreDocumentRevisionData>({
        method: 'POST',
        path: `/organizations/${organizationId}/knowledge/${documentId}/revisions/${revisionId}/restore`,
        body: { isUndo },
      })

      return data.revisionId
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['UndoableDocumentRevisions', organizationId] })
    }
  }

  return restore
}

export default useRestoreDocumentRevision
