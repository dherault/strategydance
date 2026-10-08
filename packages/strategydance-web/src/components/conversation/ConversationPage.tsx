import { useState } from 'react'
import { useIntl } from 'react-intl'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

import type { StartedConversationRun } from '~utils/conversation/isAwaitingConversationRun'

import ConversationBar from '~components/conversation/ConversationBar'
import ConversationComposer from '~components/conversation/ConversationComposer'
import ConversationHead from '~components/conversation/ConversationHead'
import ConversationLayout from '~components/conversation/ConversationLayout'
import ConversationThread from '~components/conversation/ConversationThread'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversationId: string
}

/*
  One conversation's page: the bar, the title and aspects, the thread, and the composer at its
  foot. Below `ConversationBouncer`, so the conversation is there, or the page is a draft not
  stored yet, whose thread is empty and says what to ask.

  The composer stays where it is whichever the page draws, so a draft's first message, which
  stores the conversation, leaves it mounted with whatever is written in it.

  The run the reader last started, by a send, a resume or a retry, is the page's, so the composer
  and the thread both count it as going before the live read of the latest run shows it
*/
function ConversationPage({ conversationId }: Props) {
  const { formatMessage } = useIntl()
  const { data: conversation } = useConversation(conversationId)
  const { data: run } = useConversationRun(conversationId)
  const [startedRun, setStartedRun] = useState<StartedConversationRun | null>(null)

  return (
    // The column fills the screen, as the design has it, so the composer sits at its foot however
    // short the thread, and a draft's line in the middle of what is left: the screen less the
    // column's top padding and, on a phone, the bar over the page
    <ConversationLayout className="min-h-[calc(100svh-1.25rem)] max-md:min-h-[calc(100svh-4.25rem)]">
      <ConversationBar updatedAt={conversation?.updatedAt ?? null} />
      <ConversationHead conversation={conversation} />
      {conversation ? (
        <ConversationThread
          conversation={conversation}
          run={run}
          startedRun={startedRun}
          onRunStart={setStartedRun}
        />
      ) : (
        <p className="my-auto px-2 py-6 text-center text-sm text-balance text-muted-foreground">
          {formatMessage(conversationMessages.threadEmpty)}
        </p>
      )}
      <ConversationComposer
        conversationId={conversationId}
        conversation={conversation}
        run={run}
        startedRun={startedRun}
        onRunStart={setStartedRun}
      />
    </ConversationLayout>
  )
}

export default ConversationPage
