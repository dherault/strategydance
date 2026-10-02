import { leaveDocument, updateDocumentPresence } from 'strategydance-database/web'

import type { KnowledgeDocumentPresenceWrites } from '~utils/knowledge/createKnowledgeDocumentPresence'

import { dataConnect } from '~data/firebase'

// The operations a document page's presence sends, bound to the document and the page's session
function createKnowledgeDocumentPresenceWrites(
  organizationId: string,
  documentId: string,
  sessionId: string,
): KnowledgeDocumentPresenceWrites {
  const key = { organizationId, documentId, sessionId }

  return {
    update: cursor => updateDocumentPresence(dataConnect, { ...key, cursor }),
    leave: () => leaveDocument(dataConnect, key),
  }
}

export default createKnowledgeDocumentPresenceWrites
