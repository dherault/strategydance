import { ConversationMessageKind } from 'strategydance-database/web'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

// The tool whose row offers Restore, which the organization's documents say it can
export const DELETE_DOCUMENT_TOOL_NAME = 'delete_document'

/*
  Whether a thread draws anything the organization's documents decide: a reply that links one, as
  `doc:<id>`, drawn with its current title, or a row that deleted one, which offers Restore while
  the document is gone. A thread without either never reads the documents
*/
function needsConversationDocuments(
  entries: ConversationThreadEntry[],
  bodies: ReadonlyMap<string, ConversationMessageBody>,
) {
  return entries.some(entry => {
    if (entry.kind === ConversationMessageKind.TOOL_CALL) return entry.toolName === DELETE_DOCUMENT_TOOL_NAME

    return entry.kind === ConversationMessageKind.AGENT_TEXT && Boolean(bodies.get(entry.id)?.text?.includes('doc:'))
  })
}

export default needsConversationDocuments
