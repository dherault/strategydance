import type { PropsWithChildren } from 'react'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

import Spinner from '~components/common/Spinner'

type Props = PropsWithChildren<{
  conversationId: string
}>

/*
  Holds an open window of the dock until the first reads of its conversation and latest run land,
  as `ConversationWait` holds the conversation's page, with a spinner in the window rather than over
  the screen
*/
function ConversationDockWait({ conversationId, children }: Props) {
  const { initialLoading: isConversationLoading } = useConversation(conversationId)
  const { initialLoading: isRunLoading } = useConversationRun(conversationId)

  if (isConversationLoading || isRunLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return children
}

export default ConversationDockWait
