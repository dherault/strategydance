import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

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
  Turns the first reads of the conversation and its latest run into a verdict: either failing
  offers to read again what failed, since a run that could not be read is not a conversation
  without one, and a conversation that is not there, and is not a draft, is missing. Below
  `ConversationWait`, which holds it until both reads land
*/
function ConversationBouncer({ conversationId, isNew, children }: Props) {
  const { formatMessage } = useIntl()
  const conversationRead = useConversation(conversationId)
  const runRead = useConversationRun(conversationId)
  const conversation = conversationRead.data
  const hasFailed = conversationRead.hasFailed || runRead.hasFailed
  const loading = conversationRead.loading || runRead.loading

  async function refetch() {
    await Promise.all([
      conversationRead.hasFailed ? conversationRead.refetch() : null,
      runRead.hasFailed ? runRead.refetch() : null,
    ])
  }

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
