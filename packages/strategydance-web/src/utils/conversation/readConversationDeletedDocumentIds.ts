import { ConversationMessageKind, ConversationToolStatus } from 'strategydance-database/web'

import type { ConversationThreadEntry } from '~types'

import { DELETE_DOCUMENT_TOOL_NAME } from '~utils/conversation/needsConversationDocuments'

/*
  The rows of a thread that deleted a document and may offer to restore it, whose outputs the
  thread reads together: the calls to `delete_document` that succeeded, sorted, so the read is the
  same while the rows are
*/
function readConversationDeletedDocumentIds(entries: ConversationThreadEntry[]) {
  return entries
    .filter(
      ({ kind, toolName, toolStatus }) =>
        kind === ConversationMessageKind.TOOL_CALL
        && toolName === DELETE_DOCUMENT_TOOL_NAME
        && toolStatus === ConversationToolStatus.SUCCEEDED,
    )
    .map(({ id }) => id)
    .sort()
}

export default readConversationDeletedDocumentIds
