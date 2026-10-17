import { ConversationMessageKind } from 'strategydance-database/web'

// The kinds whose body is read apart: the others are drawn from the entry alone
const KINDS_WITH_BODY: ReadonlySet<ConversationMessageKind> = new Set([
  ConversationMessageKind.MEMBER_TEXT,
  ConversationMessageKind.AGENT_TEXT,
  ConversationMessageKind.QUESTION,
  ConversationMessageKind.APPROVAL,
  ConversationMessageKind.BRIEF,
])

// The agent's tool whose calls go to an integration, which the thread names by their server
export const CALL_INTEGRATION_TOOL_NAME = 'call_integration_tool'

/*
  Whether a message of the thread has words read apart from its entry, by id: a text, a question, an
  approval, a subagent's brief, or a call to an integration, whose server and tool are its body's
*/
function hasConversationMessageBody({ kind, toolName }: { kind: ConversationMessageKind; toolName?: string | null }) {
  return (
    KINDS_WITH_BODY.has(kind) || (kind === ConversationMessageKind.TOOL_CALL && toolName === CALL_INTEGRATION_TOOL_NAME)
  )
}

export default hasConversationMessageBody
