import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import type { ConversationNoteKind } from 'strategydance-database/web'

import getConversationNoteText from '~utils/conversation/getConversationNoteText'

type Props = {
  noteKind: ConversationNoteKind
  // What the reader can do from it, under it, when it ends the latest response
  actions?: ReactNode
  // Whose run it ends: a conversation's response, or a subagent's work, which is said otherwise
  subject?: 'conversation' | 'subagent'
}

// A small centred line in the thread, saying how a response ended, with what can be done next
function ConversationNote({ noteKind, actions, subject = 'conversation' }: Props) {
  const intl = useIntl()
  const text = (
    <p className="m-0 text-center text-xs text-muted-foreground">{getConversationNoteText(intl, noteKind, subject)}</p>
  )

  if (!actions) return text

  return (
    <div className="flex flex-col items-center gap-2">
      {text}
      {actions}
    </div>
  )
}

export default ConversationNote
