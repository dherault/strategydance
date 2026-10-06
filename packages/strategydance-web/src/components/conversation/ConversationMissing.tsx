import { MessagesSquareIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import ConversationBackLink from '~components/conversation/ConversationBackLink'
import ConversationLayout from '~components/conversation/ConversationLayout'

import conversationMessages from '~data/intl/messages/conversation'

/*
  What a conversation's page shows when there is no such conversation: deleted, here or in another
  tab, which the live query says at once, or never there. The back link at the top is the way out,
  as the design has it
*/
function ConversationMissing() {
  const { formatMessage } = useIntl()

  return (
    <ConversationLayout>
      <div>
        <ConversationBackLink />
      </div>
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <MessagesSquareIcon />
          </EmptyMedia>
          <EmptyTitle>{formatMessage(conversationMessages.missingTitle)}</EmptyTitle>
          <EmptyDescription>{formatMessage(conversationMessages.missingText)}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </ConversationLayout>
  )
}

export default ConversationMissing
