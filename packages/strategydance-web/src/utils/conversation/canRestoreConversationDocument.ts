import type { KnowledgeDocumentSummary } from '~types'

import type { ConversationDeletedDocument } from '~utils/conversation/readConversationDeletedDocument'

/*
  Whether a row that deleted a document offers to restore it: while the organization's documents,
  once read, do not hold it, and a day has not passed since the call. A document restored since, by
  anybody, is back in the list, and a restore past the day would be refused
*/
function canRestoreConversationDocument(
  deleted: ConversationDeletedDocument | null,
  documents: ReadonlyMap<string, KnowledgeDocumentSummary> | null,
  now: number,
) {
  return Boolean(deleted && documents && !documents.has(deleted.documentId) && now < deleted.restorableUntil)
}

export default canRestoreConversationDocument
