import { useIntl } from 'react-intl'
import type { ConversationSpendCeiling } from 'strategydance-core'

import useNow from '~hooks/common/useNow'

import getConversationCeilingNoteText from '~utils/conversation/getConversationCeilingNoteText'

type Props = {
  ceiling: ConversationSpendCeiling
  subject: 'conversation' | 'subagent'
}

// What a failed note says of the daily spend ceiling that stopped its run, its time moving on as the
// reader waits, so it says the ceiling has room once it has
function ConversationCeilingNoteText({ ceiling, subject }: Props) {
  const intl = useIntl()
  const now = useNow()

  return getConversationCeilingNoteText(intl, ceiling, subject, now)
}

export default ConversationCeilingNoteText
