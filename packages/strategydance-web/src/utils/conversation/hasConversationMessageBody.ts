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

// The Subagents module's tool whose calls launch a subagent, which the thread draws as its row, found
// by the call's id its body holds
export const LAUNCH_SUBAGENT_TOOL_NAME = 'launch_subagent'

// The Knowledge module's tool whose calls edit a document, whose row offers Undo, found by the call's
// id its body holds while nobody has written over the edit
export const UPDATE_DOCUMENT_TOOL_NAME = 'update_document'

// The calls whose body is read: the tools above
const TOOLS_WITH_BODY: ReadonlySet<string> = new Set([
  CALL_INTEGRATION_TOOL_NAME,
  LAUNCH_SUBAGENT_TOOL_NAME,
  UPDATE_DOCUMENT_TOOL_NAME,
])

/*
  Whether a message of the thread has words read apart from its entry, by id: a text, a question, an
  approval, a subagent's brief, a call to an integration, whose server and tool are its body's, or a
  launch or an edit of a document, whose call's id is
*/
function hasConversationMessageBody({ kind, toolName }: { kind: ConversationMessageKind; toolName?: string | null }) {
  return (
    KINDS_WITH_BODY.has(kind)
    || (kind === ConversationMessageKind.TOOL_CALL && !!toolName && TOOLS_WITH_BODY.has(toolName))
  )
}

export default hasConversationMessageBody
