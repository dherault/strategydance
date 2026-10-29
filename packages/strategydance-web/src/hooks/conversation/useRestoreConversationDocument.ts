import { restoreDocument } from 'strategydance-database/web'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import { dataConnect } from '~data/firebase'

/*
  Restores a document Strategy Dance deleted, as the Documents page's Undo does, through the
  page's own `RestoreDocument`, which refuses one deleted over a day ago. The organization's live
  document list follows, which takes the thread's Restore away and draws the links to it again
*/
function useRestoreConversationDocument() {
  const { organization } = useCurrentOrganization()

  const organizationId = organization?.id ?? null

  async function restore(documentId: string) {
    if (!organizationId) throw new Error('No current organization to restore a document in')

    await restoreDocument(dataConnect, { organizationId, id: documentId })
  }

  return restore
}

export default useRestoreConversationDocument
