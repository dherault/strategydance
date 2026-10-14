import { useEffect, useEffectEvent, useState } from 'react'
import type { CompanyAspect } from 'strategydance-database/web'

import useConversation from '~hooks/conversation/useConversation'
import useConversationDock from '~hooks/conversation/useConversationDock'
import useConversationRun from '~hooks/conversation/useConversationRun'
import useConversationStartedRun from '~hooks/conversation/useConversationStartedRun'

import ConversationBar from '~components/conversation/ConversationBar'
import ConversationComposer from '~components/conversation/ConversationComposer'
import ConversationDraftThread from '~components/conversation/ConversationDraftThread'
import ConversationHead from '~components/conversation/ConversationHead'
import ConversationLayout from '~components/conversation/ConversationLayout'
import ConversationThread from '~components/conversation/ConversationThread'

type Props = {
  conversationId: string
}

/*
  One conversation's page: the bar, the title and aspects, the thread, and the composer at its
  foot. Below `ConversationBouncer`, so the conversation is there, or the page is a draft not
  stored yet, whose thread says what to ask, and draws its first message from the moment it is sent
  (`ConversationDraftThread`).

  The composer stays where it is whichever the page draws, so a draft's first message, which
  stores the conversation, leaves it mounted with whatever is written in it. A draft holds the
  aspects its reader picks until that message, which sends them, so Strategy Dance leaves them as
  they are.

  The run the reader last started, by a send, a resume or a retry, is the conversation's, so the
  composer and the thread both count it as going before the live read of the latest run shows it,
  here or in a dock's window.

  A conversation opened as its page is taken out of the dock, as the design has it: it is never
  open twice
*/
function ConversationPage({ conversationId }: Props) {
  const { data: conversation } = useConversation(conversationId)
  const { data: run } = useConversationRun(conversationId)
  const [startedRun, setStartedRun] = useConversationStartedRun(conversationId)
  const [draftAspects, setDraftAspects] = useState<CompanyAspect[]>([])
  const { closeWindow } = useConversationDock()

  const leaveDock = useEffectEvent(() => closeWindow(conversationId))

  useEffect(() => {
    leaveDock()
  }, [conversationId])

  return (
    // The column fills the screen, as the design has it, so the composer sits at its foot however
    // short the thread, and a draft's line in the middle of what is left: the screen less the
    // column's top padding and, on a phone, the bar over the page
    <ConversationLayout className="min-h-[calc(100svh-1.25rem)] max-md:min-h-[calc(100svh-4.25rem)]">
      <ConversationBar
        conversationId={conversationId}
        updatedAt={conversation?.updatedAt ?? null}
      />
      <ConversationHead
        conversation={conversation}
        draftAspects={draftAspects}
        onDraftAspectsChange={setDraftAspects}
      />
      {conversation ? (
        <ConversationThread
          conversation={conversation}
          run={run}
          startedRun={startedRun}
          onRunStart={setStartedRun}
        />
      ) : (
        <ConversationDraftThread
          conversationId={conversationId}
          run={run}
          startedRun={startedRun}
        />
      )}
      <ConversationComposer
        conversationId={conversationId}
        conversation={conversation}
        run={run}
        startedRun={startedRun}
        onRunStart={setStartedRun}
        draftAspects={draftAspects}
      />
    </ConversationLayout>
  )
}

export default ConversationPage
