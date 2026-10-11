import { ConversationMessageKind, ConversationToolStatus } from 'strategydance-database/web'

import type { ConversationThreadEntry } from '~types'

import { DELETE_DOCUMENT_TOOL_NAME } from '~utils/conversation/needsConversationDocuments'
import { DELETE_TASK_TOOL_NAME } from '~utils/conversation/needsConversationTasks'

/*
  The rows of a thread that deleted a document or a task and may offer to restore it, whose outputs
  the thread reads together: the calls to `delete_document` and `delete_task` that succeeded,
  sorted, so the read is the same while the rows are
*/
function readConversationDeletedCallIds(entries: ConversationThreadEntry[]) {
  return entries
    .filter(
      ({ kind, toolName, toolStatus }) =>
        kind === ConversationMessageKind.TOOL_CALL
        && (toolName === DELETE_DOCUMENT_TOOL_NAME || toolName === DELETE_TASK_TOOL_NAME)
        && toolStatus === ConversationToolStatus.SUCCEEDED,
    )
    .map(({ id }) => id)
    .sort()
}

export default readConversationDeletedCallIds
