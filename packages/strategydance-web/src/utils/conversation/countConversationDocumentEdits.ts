import { ConversationToolStatus } from 'strategydance-database/web'

import type { ConversationThreadEntry } from '~types'

// The tool whose row offers Undo while nobody has written over its edit
export const UPDATE_DOCUMENT_TOOL_NAME = 'update_document'

/*
  How many of a thread's rows are edits of a document that went through, the rows that may offer
  Undo: the thread reads which can once it holds any, and again when it holds more
*/
function countConversationDocumentEdits(entries: readonly ConversationThreadEntry[]) {
  return entries.filter(
    ({ toolName, toolStatus }) =>
      toolName === UPDATE_DOCUMENT_TOOL_NAME && toolStatus === ConversationToolStatus.SUCCEEDED,
  ).length
}

export default countConversationDocumentEdits
