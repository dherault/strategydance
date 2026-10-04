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

// What a note says, in the thread and in a conversation's preview, about how a run ended
function getConversationNoteText({ formatMessage }: IntlShape, noteKind: NoteKind) {
  return formatMessage(NOTE_MESSAGES[noteKind])
}

export default getConversationNoteText
