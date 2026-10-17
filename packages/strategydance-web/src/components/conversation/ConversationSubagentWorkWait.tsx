import type { PropsWithChildren } from 'react'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

import Spinner from '~components/common/Spinner'

type Props = PropsWithChildren<{
  subagentId: string
}>

/*
  Holds a subagent's viewer until the first reads of its thread and latest run land, as
  `ConversationDockWait` holds a dock's window, with a spinner in the viewer rather than over the
  screen, which would cover its head
*/
function ConversationSubagentWorkWait({ subagentId, children }: Props) {
  const { initialLoading: isConversationLoading } = useConversation(subagentId)
  const { initialLoading: isRunLoading } = useConversationRun(subagentId)

  if (isConversationLoading || isRunLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10">
        <Spinner />
      </div>
    )
  }

  return children
}

export default ConversationSubagentWorkWait
