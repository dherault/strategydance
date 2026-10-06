import { useIntl } from 'react-intl'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

import ConversationBar from '~components/conversation/ConversationBar'
import ConversationHead from '~components/conversation/ConversationHead'
import ConversationLayout from '~components/conversation/ConversationLayout'
import ConversationThread from '~components/conversation/ConversationThread'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
}

/*
  One conversation's page: the bar, the title and aspects, and the thread. Below
  `ConversationBouncer`, so the conversation is there, or the page is a draft not stored yet, whose
  thread is empty and says what to ask
*/
function ConversationPage({ conversationId }: Props) {
  const { formatMessage } = useIntl()
  const { data: conversation } = useConversation(conversationId)
  const { data: run } = useConversationRun(conversationId)

  return (
    // A draft's column fills the screen, its line in the middle of what is left, as the design has
    // it: the screen less the column's top padding and, on a phone, the bar over the page
    <ConversationLayout
      className={conversation ? undefined : 'min-h-[calc(100svh-1.25rem)] max-md:min-h-[calc(100svh-4.25rem)]'}
    >
      <ConversationBar updatedAt={conversation?.updatedAt ?? null} />
      <ConversationHead conversation={conversation} />
      {conversation ? (
        <ConversationThread
          conversation={conversation}
          run={run}
        />
      ) : (
        <p className="my-auto px-2 py-6 text-center text-sm text-balance text-muted-foreground">
          {formatMessage(conversationMessages.threadEmpty)}
        </p>
      )}
    </ConversationLayout>
  )
}

export default ConversationPage
