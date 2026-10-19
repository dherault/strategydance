import type { ConversationPreview, ConversationSpendCeiling, ConversationSpendCeilingScope } from 'strategydance-core'

type ToolStatus = Extract<ConversationPreview, { kind: 'TOOL_CALL' }>['toolStatus']
type QuestionState = Extract<ConversationPreview, { kind: 'QUESTION' }>['questionState']
type NoteKind = Extract<ConversationPreview, { kind: 'NOTE' }>['noteKind']
type ApprovalState = Extract<ConversationPreview, { kind: 'APPROVAL' }>['approvalState']

const TOOL_STATUSES: readonly unknown[] = ['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] satisfies ToolStatus[]
const QUESTION_STATES: readonly unknown[] = ['WAITING', 'ANSWERED', 'SKIPPED'] satisfies QuestionState[]
const NOTE_KINDS: readonly unknown[] = ['STOPPED', 'FAILED', 'REFUSED', 'INTERRUPTED', 'FULL'] satisfies NoteKind[]
const APPROVAL_STATES: readonly unknown[] = ['PENDING', 'ALLOWED', 'DENIED'] satisfies ApprovalState[]
const CEILING_SCOPES: readonly unknown[] = [
  'MEMBER',
  'ACCOUNT',
  'ORGANIZATION',
] satisfies ConversationSpendCeilingScope[]

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
      if (typeof preview.text !== 'string') return null

      // The files it sent, which say something of a message holding none of its own words
      return Number.isSafeInteger(preview.attachmentCount)
        && (preview.attachmentCount as number) > 0
        && typeof preview.attachmentName === 'string'
        ? {
            kind: preview.kind,
            text: preview.text,
            attachmentCount: preview.attachmentCount as number,
            attachmentName: preview.attachmentName,
          }
        : { kind: preview.kind, text: preview.text }
    case 'AGENT_TEXT':
      return typeof preview.text === 'string' ? { kind: preview.kind, text: preview.text } : null
    case 'TOOL_CALL':
      if (typeof preview.toolName !== 'string' || !TOOL_STATUSES.includes(preview.toolStatus)) return null

      return {
        kind: preview.kind,
        toolName: preview.toolName,
        toolStatus: preview.toolStatus as ToolStatus,
        // The server a call to an integration went to, which names it
        ...(typeof preview.integrationName === 'string' ? { integrationName: preview.integrationName } : {}),
      }
    case 'APPROVAL':
      return typeof preview.integrationName === 'string'
        && typeof preview.integrationToolName === 'string'
        && APPROVAL_STATES.includes(preview.approvalState)
        && (preview.toolStatus === null || TOOL_STATUSES.includes(preview.toolStatus))
        ? {
            kind: preview.kind,
            integrationName: preview.integrationName,
            integrationToolName: preview.integrationToolName,
            approvalState: preview.approvalState as ApprovalState,
            toolStatus: preview.toolStatus as ToolStatus | null,
          }
        : null
    case 'QUESTION':
      return typeof preview.text === 'string' && QUESTION_STATES.includes(preview.questionState)
        ? { kind: preview.kind, questionState: preview.questionState as QuestionState, text: preview.text }
        : null
    case 'NOTE':
      return NOTE_KINDS.includes(preview.noteKind)
        ? {
            kind: preview.kind,
            noteKind: preview.noteKind as NoteKind,
            ...(isSpendCeiling(preview.ceiling) ? { ceiling: preview.ceiling } : {}),
          }
        : null
    default:
      return null
  }
}

// A failed note's daily spend ceiling, whose and when it has room again, or nothing this page can read
function isSpendCeiling(value: unknown): value is ConversationSpendCeiling {
  if (!value || typeof value !== 'object') return false

  const { scope, freesAt } = value as Record<string, unknown>

  return CEILING_SCOPES.includes(scope) && typeof freesAt === 'string' && !Number.isNaN(Date.parse(freesAt))
}

export default parseConversationPreview
