import type { ConversationPreview } from 'strategydance-core'

type ToolStatus = Extract<ConversationPreview, { kind: 'TOOL_CALL' }>['toolStatus']
type QuestionState = Extract<ConversationPreview, { kind: 'QUESTION' }>['questionState']
type NoteKind = Extract<ConversationPreview, { kind: 'NOTE' }>['noteKind']

const TOOL_STATUSES: readonly unknown[] = ['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] satisfies ToolStatus[]
const QUESTION_STATES: readonly unknown[] = ['WAITING', 'ANSWERED', 'SKIPPED'] satisfies QuestionState[]
const NOTE_KINDS: readonly unknown[] = ['STOPPED', 'FAILED', 'REFUSED', 'INTERRUPTED', 'FULL'] satisfies NoteKind[]

/*
  A conversation's `preview`, as strategydance-core's `buildConversationPreview` wrote it, read back
  from a column of any JSON. Whatever does not have its shape reads as null: a preview of a kind a
  later release added, say, which this page cannot word
*/
function parseConversationPreview(value: unknown): ConversationPreview | null {
  if (!value || typeof value !== 'object') return null

  const preview = value as Record<string, unknown>

  switch (preview.kind) {
    case 'MEMBER_TEXT':
    case 'AGENT_TEXT':
      return typeof preview.text === 'string' ? { kind: preview.kind, text: preview.text } : null
    case 'TOOL_CALL':
      return typeof preview.toolName === 'string' && TOOL_STATUSES.includes(preview.toolStatus)
        ? { kind: preview.kind, toolName: preview.toolName, toolStatus: preview.toolStatus as ToolStatus }
        : null
    case 'QUESTION':
      return typeof preview.text === 'string' && QUESTION_STATES.includes(preview.questionState)
        ? { kind: preview.kind, questionState: preview.questionState as QuestionState, text: preview.text }
        : null
    case 'NOTE':
      return NOTE_KINDS.includes(preview.noteKind)
        ? { kind: preview.kind, noteKind: preview.noteKind as NoteKind }
        : null
    default:
      return null
  }
}

export default parseConversationPreview
