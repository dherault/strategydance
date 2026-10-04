import { ConversationMessageKind } from 'strategydance-database/web'

// The kinds whose body is read apart: the others are drawn from the entry alone
const KINDS_WITH_BODY: ReadonlySet<ConversationMessageKind> = new Set([
  ConversationMessageKind.MEMBER_TEXT,
  ConversationMessageKind.AGENT_TEXT,
  ConversationMessageKind.QUESTION,
])

// Whether a message of the thread has words read apart from its entry, by id
function hasConversationMessageBody(kind: ConversationMessageKind) {
  return KINDS_WITH_BODY.has(kind)
}

export default hasConversationMessageBody
