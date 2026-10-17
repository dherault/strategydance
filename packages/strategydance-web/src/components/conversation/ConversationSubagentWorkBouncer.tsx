import type { PropsWithChildren } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import useConversation from '~hooks/conversation/useConversation'
import useConversationRun from '~hooks/conversation/useConversationRun'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = PropsWithChildren<{
  subagentId: string
}>

/*
  Turns the first reads of a subagent's thread and run into a verdict, as
  `ConversationDockWindowBouncer` does for a dock's window: a read that failed offers to read again,
  and a subagent no longer there, deleted with its parent elsewhere say, says so. Below
  `ConversationSubagentWorkWait`
*/
function ConversationSubagentWorkBouncer({ subagentId, children }: Props) {
  const { formatMessage } = useIntl()
  const conversationRead = useConversation(subagentId)
  const runRead = useConversationRun(subagentId)
  const loading = conversationRead.loading || runRead.loading

  async function refetch() {
    await Promise.all([
      conversationRead.hasFailed ? conversationRead.refetch() : null,
      runRead.hasFailed ? runRead.refetch() : null,
    ])
  }

  if (conversationRead.hasFailed || runRead.hasFailed) {
    return (
      <div className="flex flex-col items-start gap-4 py-4">
        <Alert variant="danger">{formatMessage(conversationMessages.subagentWorkLoadError)}</Alert>
        <Button
          variant="outline"
          disabled={loading}
          icon={loading ? <Spinner tone="current" /> : undefined}
          onClick={refetch}
        >
          {formatMessage(conversationMessages.retry)}
        </Button>
      </div>
    )
  }

  if (!conversationRead.data) {
    return (
      <p className="m-0 py-4 text-sm text-muted-foreground">
        {formatMessage(conversationMessages.subagentWorkMissing)}
      </p>
    )
  }

  return children
}

export default ConversationSubagentWorkBouncer
