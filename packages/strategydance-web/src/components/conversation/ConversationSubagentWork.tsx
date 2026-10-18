import type { RefObject } from 'react'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

import ConversationThread from '~components/conversation/ConversationThread'

type Props = {
  subagentId: string
  // The viewer's box the thread scrolls in
  scrollerRef: RefObject<HTMLElement | null>
}

/*
  What a subagent did, its own thread, live and read only, as its viewer draws it: the brief with
  its files, every call it made, each opening its input and output, its replies and its notes, with
  the thinking indicator while it works. Below `ConversationSubagentWorkBouncer`, so it is there
*/
function ConversationSubagentWork({ subagentId, scrollerRef }: Props) {
  const { data: subagent } = useConversation(subagentId)
  const { data: run } = useConversationRun(subagentId)

  if (!subagent) return null

  return (
    <ConversationThread
      conversation={subagent}
      run={run}
      scrollerRef={scrollerRef}
    />
  )
}

export default ConversationSubagentWork
