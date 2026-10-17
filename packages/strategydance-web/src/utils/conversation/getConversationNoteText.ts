import type { IntlShape } from 'react-intl'
import type { ConversationPreview } from 'strategydance-core'

import conversationMessages from '~data/intl/messages/conversation'

type NoteKind = Extract<ConversationPreview, { kind: 'NOTE' }>['noteKind']

const NOTE_MESSAGES = {
  STOPPED: conversationMessages.noteStopped,
  FAILED: conversationMessages.noteFailed,
  REFUSED: conversationMessages.noteRefused,
  INTERRUPTED: conversationMessages.noteInterrupted,
  FULL: conversationMessages.noteFull,
} satisfies Record<NoteKind, unknown>

// A subagent's, whose runs nobody reading answered: its parent or the reader may have stopped it
const SUBAGENT_NOTE_MESSAGES = {
  STOPPED: conversationMessages.subagentNoteStopped,
  FAILED: conversationMessages.subagentNoteFailed,
  REFUSED: conversationMessages.subagentNoteRefused,
  INTERRUPTED: conversationMessages.subagentNoteInterrupted,
  FULL: conversationMessages.subagentNoteFull,
} satisfies Record<NoteKind, unknown>

/*
  What a note says, in the thread and in a conversation's preview, about how a run ended: a
  conversation's response, or a subagent's work
*/
function getConversationNoteText(
  { formatMessage }: IntlShape,
  noteKind: NoteKind,
  subject: 'conversation' | 'subagent' = 'conversation',
) {
  return formatMessage((subject === 'subagent' ? SUBAGENT_NOTE_MESSAGES : NOTE_MESSAGES)[noteKind])
}

export default getConversationNoteText
