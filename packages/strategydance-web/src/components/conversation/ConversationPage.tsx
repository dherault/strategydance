import useConversation from '~hooks/conversation/useConversation'

import ConversationBar from '~components/conversation/ConversationBar'
import ConversationHead from '~components/conversation/ConversationHead'
import ConversationLayout from '~components/conversation/ConversationLayout'

type Props = {
  conversationId: string
}

/*
  One conversation's page: the bar, the title and aspects, and the thread. Below
  `ConversationBouncer`, so the conversation is there, or the page is a draft not stored yet
*/
function ConversationPage({ conversationId }: Props) {
  const { data: conversation } = useConversation(conversationId)

  return (
    <ConversationLayout>
      <ConversationBar updatedAt={conversation?.updatedAt ?? null} />
      <ConversationHead conversation={conversation} />
    </ConversationLayout>
  )
}

export default ConversationPage
