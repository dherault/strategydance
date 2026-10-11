import { ConversationMessageKind, ConversationToolStatus } from 'strategydance-database/web'

import type { ConversationThreadEntry } from '~types'

import { DELETE_DOCUMENT_TOOL_NAME } from '~utils/conversation/needsConversationDocuments'

// How many calls' outputs one read takes, `GetConversationToolOutputs`' limit
const MAX_OUTPUTS = 50

/*
  The rows of a thread that deleted a document and may offer to restore it, whose outputs the
  thread reads in one go: the calls to `delete_document` that succeeded, the latest 50, sorted, so
  the read is the same while the rows are
*/
function readConversationDeletedDocumentIds(entries: ConversationThreadEntry[]) {
  return entries
    .filter(
      ({ kind, toolName, toolStatus }) =>
        kind === ConversationMessageKind.TOOL_CALL
        && toolName === DELETE_DOCUMENT_TOOL_NAME
        && toolStatus === ConversationToolStatus.SUCCEEDED,
    )
    .slice(-MAX_OUTPUTS)
    .map(({ id }) => id)
    .sort()
}

export default readConversationDeletedDocumentIds
