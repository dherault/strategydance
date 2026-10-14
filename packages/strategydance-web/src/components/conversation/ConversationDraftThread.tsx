import { useIntl } from 'react-intl'

import type { ConversationRun } from '~types'

import useConversationDocuments from '~hooks/conversation/useConversationDocuments'
import useConversationPendingMessage from '~hooks/conversation/useConversationPendingMessage'

import isAwaitingConversationRun, { type StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'
import isConversationRunGoing from '~utils/conversation/isConversationRunGoing'

import ConversationMemberMessage from '~components/conversation/ConversationMemberMessage'
import ConversationThinking from '~components/conversation/ConversationThinking'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
  // The conversation's latest run, which its first message starts, or null before it is read
  run: ConversationRun | null
  // The run the reader last started from the page, and what records it
  startedRun: StartedConversationRun | null
  // Small in a dock's window, which is narrow
  size?: 'sm' | 'md'
}

/*
  A draft's thread, until the conversation its first message stores is read: a line saying what to
  ask, then, from the moment the reader sends that message, the message as they sent it and the
  thinking indicator under it, as `ConversationThread` goes on drawing them once the conversation
  is read. Should the send fail, the message goes back to the composer and the line comes back
*/
function ConversationDraftThread({ conversationId, run, startedRun, size = 'md' }: Props) {
  const { formatMessage } = useIntl()
  const { pendingMessage, isSending } = useConversationPendingMessage(conversationId)
  const documents = useConversationDocuments(/doc:/i.test(pendingMessage?.text ?? ''))

  const isWorking = isConversationRunGoing(run)

  if (!pendingMessage) {
    return (
      <p className="my-auto px-2 py-6 text-center text-sm text-balance text-muted-foreground">
        {formatMessage(conversationMessages.threadEmpty)}
      </p>
    )
  }

  return (
    <div className="flex grow flex-col py-2">
      <div
        role="log"
        aria-label={formatMessage(conversationMessages.threadLabel)}
        className="flex flex-col gap-4"
      >
        <div
          data-entry-id={pendingMessage.id}
          className="flex min-w-0 flex-col"
        >
          <ConversationMemberMessage
            conversationId={conversationId}
            text={pendingMessage.text}
            attachments={pendingMessage.attachments}
            documents={documents}
            size={size}
          />
        </div>
        {isWorking || isSending || isAwaitingConversationRun(startedRun, run) ? (
          <ConversationThinking
            step={null}
            startedAt={isWorking ? (run?.createdAt ?? null) : null}
          />
        ) : null}
      </div>
    </div>
  )
}

export default ConversationDraftThread
