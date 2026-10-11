import { useRef } from 'react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'
import useConversationStartedRun from '~hooks/conversation/useConversationStartedRun'

import ConversationComposer from '~components/conversation/ConversationComposer'
import ConversationThread from '~components/conversation/ConversationThread'

import conversationMessages from '~data/intl/messages/conversation'

const NO_ASPECTS: CompanyAspect[] = []

type Props = {
  conversationId: string
  // Whether the composer's field takes the focus as it appears
  isAutoFocused: boolean
}

/*
  What an open window of the dock holds: the conversation's thread, small, in a box of its own that
  scrolls, or a draft's line saying what to ask, and the composer under it. As on the page, the
  composer stays where it is whichever the window draws, so a draft's first message, which stores
  the conversation, leaves it mounted, and the run the reader last started is the conversation's, so
  the composer and the thread both count it as going before the live read of the latest run shows
  it, here or on the page
*/
function ConversationDockWindowBody({ conversationId, isAutoFocused }: Props) {
  const { formatMessage } = useIntl()
  const { data: conversation } = useConversation(conversationId)
  const { data: run } = useConversationRun(conversationId)
  const [startedRun, setStartedRun] = useConversationStartedRun(conversationId)
  const scrollerRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2 [overflow-anchor:none]"
      >
        {conversation ? (
          <ConversationThread
            conversation={conversation}
            run={run}
            startedRun={startedRun}
            onRunStart={setStartedRun}
            scrollerRef={scrollerRef}
            size="sm"
          />
        ) : (
          <p className="my-auto px-2 py-6 text-center text-sm text-balance text-muted-foreground">
            {formatMessage(conversationMessages.threadEmpty)}
          </p>
        )}
      </div>
      <ConversationComposer
        conversationId={conversationId}
        conversation={conversation}
        run={run}
        startedRun={startedRun}
        onRunStart={setStartedRun}
        // A window has no aspects to pick, so its draft's first message leaves them to Strategy Dance
        draftAspects={NO_ASPECTS}
        variant="dock"
        scrollerRef={scrollerRef}
        isAutoFocused={isAutoFocused}
      />
    </>
  )
}

export default ConversationDockWindowBody
