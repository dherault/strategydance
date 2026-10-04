import type { PropsWithChildren } from 'react'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

import Loading from '~components/common/Loading'

type Props = PropsWithChildren<{
  conversationId: string
}>

/*
  Holds a conversation's page until the first reads of the conversation and its latest run land, so
  the thread draws whole, with its indicator if a run goes. `initialLoading` rather than `loading`,
  since the live queries write over both while somebody reads them
*/
function ConversationWait({ conversationId, children }: Props) {
  const { initialLoading: isConversationLoading } = useConversation(conversationId)
  const { initialLoading: isRunLoading } = useConversationRun(conversationId)

  if (isConversationLoading || isRunLoading) {
    return <Loading source="ConversationWait" />
  }

  return children
}

export default ConversationWait
