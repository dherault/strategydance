import { ConversationMessageKind, ConversationToolStatus } from 'strategydance-database/web'

import type { ConversationThreadEntry } from '~types'

import { DELETE_BILL_TOOL_NAME } from '~utils/conversation/needsConversationBills'
import { DELETE_DOCUMENT_TOOL_NAME } from '~utils/conversation/needsConversationDocuments'
import { DELETE_TASK_TOOL_NAME } from '~utils/conversation/needsConversationTasks'

// The tools whose rows may offer to restore what they deleted
const DELETE_TOOL_NAMES = [DELETE_DOCUMENT_TOOL_NAME, DELETE_TASK_TOOL_NAME, DELETE_BILL_TOOL_NAME]

/*
  The rows of a thread that deleted a document, a task or a bill and may offer to restore it, whose
  outputs the thread reads together: the calls to `delete_document`, `delete_task` and `delete_bill`
  that succeeded, sorted, so the read is the same while the rows are
*/
function readConversationDeletedCallIds(entries: ConversationThreadEntry[]) {
  return entries
    .filter(
      ({ kind, toolName, toolStatus }) =>
        kind === ConversationMessageKind.TOOL_CALL
        && DELETE_TOOL_NAMES.some(name => name === toolName)
        && toolStatus === ConversationToolStatus.SUCCEEDED,
    )
    .map(({ id }) => id)
    .sort()
}

export default readConversationDeletedCallIds
