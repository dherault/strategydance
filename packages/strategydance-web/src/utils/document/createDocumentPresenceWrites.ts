import { leaveDocument, updateDocumentPresence } from 'strategydance-database/web'

import type { DocumentPresenceWrites } from '~utils/document/createDocumentPresence'

import { dataConnect } from '~data/firebase'

// The operations a document page's presence sends, bound to the document and the page's session
function createDocumentPresenceWrites(
  organizationId: string,
  documentId: string,
  sessionId: string,
): DocumentPresenceWrites {
  const key = { organizationId, documentId, sessionId }

  return {
    update: cursor => updateDocumentPresence(dataConnect, { ...key, cursor }),
    leave: () => leaveDocument(dataConnect, key),
  }
}

export default createDocumentPresenceWrites
