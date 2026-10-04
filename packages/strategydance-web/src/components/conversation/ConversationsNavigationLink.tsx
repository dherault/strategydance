import { MessagesSquareIcon } from 'lucide-react'
import { useIntl } from 'react-intl'

import useConversationsAwaitingAnswer from '~hooks/conversation/useConversationsAwaitingAnswer'

import NavigationLink from '~components/layout/NavigationLink'

import navigationMessages from '~data/intl/messages/navigation'

/*
  The sidebar's way to the reader's conversations, with a count of those where a question waits
  for their answer. Its own component, so that only a reader who may have conversations reads the
  count at all
*/
function ConversationsNavigationLink() {
  const { formatMessage } = useIntl()
  const awaitingAnswerIds = useConversationsAwaitingAnswer()
  const count = awaitingAnswerIds.length

  return (
    <NavigationLink
      path="/conversations"
      isNested
      label={formatMessage(navigationMessages.conversations)}
      icon={<MessagesSquareIcon />}
      link={{ to: '/conversations' }}
      badge={
        count ? { count, label: formatMessage(navigationMessages.conversationsAwaitingAnswer, { count }) } : undefined
      }
    />
  )
}

export default ConversationsNavigationLink
