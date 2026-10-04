import { useIntl } from 'react-intl'
import type { ConversationNoteKind } from 'strategydance-database/web'

import getConversationNoteText from '~utils/conversation/getConversationNoteText'

type Props = {
  noteKind: ConversationNoteKind
}

// A small centred line in the thread, saying how a response ended
function ConversationNote({ noteKind }: Props) {
  const intl = useIntl()

  return <p className="m-0 text-center text-xs text-muted-foreground">{getConversationNoteText(intl, noteKind)}</p>
}

export default ConversationNote
