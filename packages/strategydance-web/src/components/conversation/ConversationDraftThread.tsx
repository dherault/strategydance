import { useIntl } from 'react-intl'

import useConversationDocuments from '~hooks/conversation/useConversationDocuments'
import useConversationPendingMessage from '~hooks/conversation/useConversationPendingMessage'

import ConversationMemberMessage from '~components/conversation/ConversationMemberMessage'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
  // Small in a dock's window, which is narrow
  size?: 'sm' | 'md'
}

/*
  A draft's thread, until the conversation its first message stores is read: a line saying what to
  ask, then, from the moment the reader sends that message, the message as they sent it, as
  `ConversationThread` goes on drawing it once the conversation is read. Should the send fail, the message goes back to the composer and the line comes back
*/
function ConversationDraftThread({ conversationId, size = 'md' }: Props) {
  const { formatMessage } = useIntl()
  const { pendingMessage } = useConversationPendingMessage(conversationId)
  const documents = useConversationDocuments(/doc:/i.test(pendingMessage?.text ?? ''))

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
      </div>
    </div>
  )
}

export default ConversationDraftThread
