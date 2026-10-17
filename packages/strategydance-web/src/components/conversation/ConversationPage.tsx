import { useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useState } from 'react'
import type { CompanyAspect } from 'strategydance-database/web'

import useConversation from '~hooks/conversation/useConversation'
import useConversationDock from '~hooks/conversation/useConversationDock'
import useConversationRun from '~hooks/conversation/useConversationRun'
import useConversationStartedRun from '~hooks/conversation/useConversationStartedRun'
import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import toHyphenatedUuid from '~utils/common/toHyphenatedUuid'

import ConversationBar from '~components/conversation/ConversationBar'
import ConversationComposer from '~components/conversation/ConversationComposer'
import ConversationDraftThread from '~components/conversation/ConversationDraftThread'
import ConversationHead from '~components/conversation/ConversationHead'
import ConversationLayout from '~components/conversation/ConversationLayout'
import ConversationSubagentViewer from '~components/conversation/ConversationSubagentViewer'
import ConversationThread from '~components/conversation/ConversationThread'

type Props = {
  conversationId: string
  // The subagent whose work is open over the page, as its address says
  viewedSubagentId: string | null
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
  open twice.

  A subagent's work opens over the page from its row, as a step of the address, `?subagent=<id>`,
  so a phone's Back closes it, and closing it steps back to the conversation's own entry rather than
  adding one, as a task's dialog does over the board. Opened by an address, closing it replaces the
  address with the conversation's
*/
function ConversationPage({ conversationId, viewedSubagentId }: Props) {
  const { data: conversation } = useConversation(conversationId)
  const { data: run } = useConversationRun(conversationId)
  const [startedRun, setStartedRun] = useConversationStartedRun(conversationId)
  const [draftAspects, setDraftAspects] = useState<CompanyAspect[]>([])
  const navigate = useNavigate()
  const router = useRouter()
  const organizationSlug = useCurrentOrganizationSlug()
  const isFromConversationThread = useLocation({
    select: location => location.state.isFromConversationThread === true,
  })
  const { closeWindow } = useConversationDock()

  const leaveDock = useEffectEvent(() => closeWindow(conversationId))

  useEffect(() => {
    leaveDock()
  }, [conversationId])

  function viewSubagent(subagentId: string) {
    navigate({
      to: '/$organizationSlug/conversations/$conversationId',
      params: { organizationSlug, conversationId },
      search: { subagent: toHyphenatedUuid(subagentId) },
      state: { isFromConversationThread: true },
      resetScroll: false,
    })
  }

  function closeSubagent() {
    if (isFromConversationThread) {
      router.history.back()

      return
    }

    navigate({
      to: '/$organizationSlug/conversations/$conversationId',
      params: { organizationSlug, conversationId },
      search: {},
      replace: true,
      resetScroll: false,
    })
  }

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
          onViewSubagent={viewSubagent}
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
      <ConversationSubagentViewer
        conversationId={conversationId}
        subagentId={viewedSubagentId}
        onClose={closeSubagent}
      />
    </ConversationLayout>
  )
}

export default ConversationPage
