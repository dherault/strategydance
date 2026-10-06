import { useIntl } from 'react-intl'
import { Skeleton } from 'strategydance-design-system/components/ui/Skeleton'
import { cn } from 'strategydance-design-system/lib/utils'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // On the right, where the reader's own messages sit
  isMember?: boolean
}

// A line standing in for a message whose words are still on their way
function ConversationMessagePlaceholder({ isMember = false }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Skeleton
      role="img"
      aria-label={formatMessage(conversationMessages.messageLoading)}
      className={cn('h-6', isMember ? 'w-1/3 self-end' : 'w-2/3')}
    />
  )
}

export default ConversationMessagePlaceholder
