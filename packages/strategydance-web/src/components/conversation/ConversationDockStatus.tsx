import { useIntl } from 'react-intl'
import { Pill } from 'strategydance-design-system/components/ui/Pill'

import type { DockConversation } from '~types'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversation: DockConversation
}

/*
  What a minimized window, or the "+N" menu, says of its conversation beside the title: a spinner
  while Strategy Dance works on it, then the count of replies unread, then a dot while a question
  waits for the reader. Each is said in words to a screen reader
*/
function ConversationDockStatus({ conversation }: Props) {
  const { formatMessage } = useIntl()
  const { activeRunId, unreadCount, isAwaitingAnswer } = conversation

  if (activeRunId) {
    return (
      <Spinner
        size="sm"
        tone="muted"
        aria-label={formatMessage(conversationMessages.dockWorking)}
        className="shrink-0"
      />
    )
  }

  if (!unreadCount && !isAwaitingAnswer) return null

  return (
    <>
      <Pill
        size="sm"
        count={unreadCount || undefined}
        aria-hidden="true"
      />
      <span className="sr-only">
        {unreadCount
          ? formatMessage(conversationMessages.dockUnread, { count: unreadCount })
          : formatMessage(conversationMessages.dockWaiting)}
      </span>
    </>
  )
}

export default ConversationDockStatus
