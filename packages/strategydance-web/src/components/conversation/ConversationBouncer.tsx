import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useConversation from '~hooks/conversation/useConversation'

import Spinner from '~components/common/Spinner'
import ConversationBackLink from '~components/conversation/ConversationBackLink'
import ConversationLayout from '~components/conversation/ConversationLayout'
import ConversationMissing from '~components/conversation/ConversationMissing'

import conversationMessages from '~data/intl/messages/conversation'

type Props = PropsWithChildren<{
  conversationId: string
  // Whether the address opened a draft, which has nothing stored to find
  isNew: boolean
}>

/*
  Turns the conversation's first read into a verdict: one that failed offers to try again, and a
  conversation that is not there, and is not a draft, is missing. Below `ConversationWait`, which
  holds it until the read lands
*/
function ConversationBouncer({ conversationId, isNew, children }: Props) {
  const { formatMessage } = useIntl()
  const { data: conversation, loading, refetch, hasFailed } = useConversation(conversationId)

  if (hasFailed) {
    return (
      <ConversationLayout>
        <div>
          <ConversationBackLink />
        </div>
        <div className="flex flex-col items-start gap-4">
          <Alert variant="danger">{formatMessage(conversationMessages.conversationLoadError)}</Alert>
          <Button
            variant="outline"
            disabled={loading}
            icon={loading ? <Spinner tone="current" /> : undefined}
            onClick={refetch}
          >
            {formatMessage(conversationMessages.retry)}
          </Button>
        </div>
      </ConversationLayout>
    )
  }

  if (!conversation && !isNew) return <ConversationMissing />

  return children
}

export default ConversationBouncer
