import { ConversationMessageKind } from 'strategydance-database/web'

import type { ConversationMessageBody, ConversationThreadEntry } from '~types'

// The tool whose row offers Restore, which the organization's documents say it can
export const DELETE_DOCUMENT_TOOL_NAME = 'delete_document'

// The messages whose words can link to knowledge
const TEXT_KINDS: ReadonlySet<ConversationMessageKind> = new Set([
  ConversationMessageKind.AGENT_TEXT,
  ConversationMessageKind.MEMBER_TEXT,
  ConversationMessageKind.BRIEF,
])

/*
  Whether a thread draws anything the organization's documents decide: a reply or a subagent's brief
  that links one, or a member's message that mentions one, as `doc:<id>`, whatever the case of its
  scheme, which a link's address is read in, drawn with its current title, or a row that deleted one,
  which offers Restore while the document is gone. A thread without any never reads the documents
*/
function needsConversationDocuments(
  entries: ConversationThreadEntry[],
  bodies: ReadonlyMap<string, ConversationMessageBody>,
) {
  return entries.some(entry => {
    if (entry.kind === ConversationMessageKind.TOOL_CALL) return entry.toolName === DELETE_DOCUMENT_TOOL_NAME

    if (!TEXT_KINDS.has(entry.kind)) return false

    return /doc:/i.test(bodies.get(entry.id)?.text ?? '')
  })
}

export default needsConversationDocuments
