import { type RefObject, useRef } from 'react'
import { useIntl } from 'react-intl'

import type { ConversationRun } from '~types'

import useConversationDocuments from '~hooks/conversation/useConversationDocuments'
import useConversationThreadScroll from '~hooks/conversation/useConversationThreadScroll'

import getConversationThinkingStart from '~utils/conversation/getConversationThinkingStart'
import isAwaitingConversationRun, { type StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'
import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'

import ConversationMemberMessage from '~components/conversation/ConversationMemberMessage'
import ConversationThinking from '~components/conversation/ConversationThinking'

import type { ConversationPendingMessage } from '~data/conversationComposerDrafts'
import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
  // The messages sent, oldest first, and the one whose send is going, if any
  pendingMessages: readonly ConversationPendingMessage[]
  sendingMessage: ConversationPendingMessage | null
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
  A draft's first message as the reader sent it, and the thinking indicator under it, until the
  conversation it stores is read. The reader is kept where they read as `ConversationThread` keeps
  them, so a composer growing in a dock's window, or a thumbnail landing, leaves the indicator in view
*/
function ConversationDraftThreadMessages({
  conversationId,
  pendingMessages,
  sendingMessage,
  run,
  startedRun,
  scrollerRef,
  size = 'md',
}: Props) {
  const { formatMessage } = useIntl()
  const listRef = useRef<HTMLDivElement>(null)
  const documents = useConversationDocuments(pendingMessages.some(({ text }) => /doc:/i.test(text)))

  const isWorking = isConversationRunGoing(run)
  const isAwaiting = isAwaitingConversationRun(startedRun, run)

  useConversationThreadScroll(listRef, scrollerRef)

  return (
    <div className="flex grow flex-col py-2">
      <div
        ref={listRef}
        role="log"
        aria-label={formatMessage(conversationMessages.threadLabel)}
        className="flex flex-col gap-4"
      >
        {pendingMessages.map(({ id, text, attachments }) => (
          <div
            key={id}
            data-entry-id={id}
            className="flex min-w-0 flex-col"
          >
            <ConversationMemberMessage
              conversationId={conversationId}
              text={text}
              attachments={attachments}
              documents={documents}
              size={size}
            />
          </div>
        ))}
        {isWorking || sendingMessage || isAwaiting ? (
          <ConversationThinking
            step={null}
            startedAt={getConversationThinkingStart({ run, isWorking, sendingMessage, startedRun, isAwaiting })}
          />
        ) : null}
      </div>
    </div>
  )
}

export default ConversationDraftThreadMessages
