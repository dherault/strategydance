import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = PropsWithChildren<{
  conversationId: string
  // Whether the window holds a draft, which has nothing stored to find
  isDraft: boolean
}>

/*
  Turns the first reads of an open window's conversation and run into a verdict, as
  `ConversationBouncer` does for the page: a read that failed offers to read again, and a
  conversation that is not there, and is not a draft, draws nothing, since the dock is about to let
  go of its window. Below `ConversationDockWait`
*/
function ConversationDockWindowBouncer({ conversationId, isDraft, children }: Props) {
  const { formatMessage } = useIntl()
  const conversationRead = useConversation(conversationId)
  const runRead = useConversationRun(conversationId)
  const loading = conversationRead.loading || runRead.loading

  async function refetch() {
    await Promise.all([
      conversationRead.hasFailed ? conversationRead.refetch() : null,
      runRead.hasFailed ? runRead.refetch() : null,
    ])
  }

  if (conversationRead.hasFailed || runRead.hasFailed) {
    return (
      <div className="flex flex-col items-start gap-3 p-3">
        <Alert variant="danger">{formatMessage(conversationMessages.conversationLoadError)}</Alert>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          icon={loading ? <Spinner tone="current" /> : undefined}
          onClick={refetch}
        >
          {formatMessage(conversationMessages.retry)}
        </Button>
      </div>
    )
  }

  if (!conversationRead.data && !isDraft) return null

  return children
}

export default ConversationDockWindowBouncer
