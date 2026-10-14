import type { RefObject } from 'react'
import { useIntl } from 'react-intl'

import type { ConversationRun } from '~types'

import useConversationPendingMessages from '~hooks/conversation/useConversationPendingMessages'

import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

import ConversationDraftThreadMessages from '~components/conversation/ConversationDraftThreadMessages'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
  // The conversation's latest run, which its first message starts, or null before it is read
  run: ConversationRun | null
  // The run the reader last started from the page, and what records it
  startedRun: StartedConversationRun | null
  // The box the thread scrolls in, in a dock's window, or none on the page, where the window scrolls
  scrollerRef?: RefObject<HTMLElement | null>
  // Small in a dock's window, which is narrow
  size?: 'sm' | 'md'
}

/*
  A draft's thread, until the conversation its first message stores is read: a line saying what to
  ask, then, from the moment the reader sends that message, the message as they sent it and the
  thinking indicator under it (`ConversationDraftThreadMessages`), as `ConversationThread` goes on
  drawing them once the conversation is read. Should the send fail, the message goes back to the
  composer and the line comes back. Only the messages follow the reader's scroll, so nothing moves
  the page while the line is all there is
*/
function ConversationDraftThread({ conversationId, run, startedRun, scrollerRef, size = 'md' }: Props) {
  const { formatMessage } = useIntl()
  const { pendingMessages, sendingMessage } = useConversationPendingMessages(conversationId)

  if (!pendingMessages.length) {
    return (
      <p className="my-auto px-2 py-6 text-center text-sm text-balance text-muted-foreground">
        {formatMessage(conversationMessages.threadEmpty)}
      </p>
    )
  }

  return (
    <ConversationDraftThreadMessages
      conversationId={conversationId}
      pendingMessages={pendingMessages}
      sendingMessage={sendingMessage}
      run={run}
      startedRun={startedRun}
      scrollerRef={scrollerRef}
      size={size}
    />
  )
}

export default ConversationDraftThread
