import { InboxIcon } from 'lucide-react'
import { useState } from 'react'
import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Conversation, ConversationRun } from '~types'

import useConversationSubagents from '~hooks/conversation/useConversationSubagents'
import useStopConversationSubagents from '~hooks/conversation/useStopConversationSubagents'

import getConversationSubagentsSummary from '~utils/conversation/getConversationSubagentsSummary'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  conversation: Conversation
  // Its latest run, or null before its first
  run: ConversationRun | null
  // At the foot of the conversation's page, or of a dock's window
  variant: 'page' | 'dock'
}

/*
  The strip above a conversation's composer, while its subagents need saying: how many still work,
  with Stop all, since they mostly work while the conversation is idle and its own Stop does not
  show; and how many reports wait for the reader's next message, once the conversation ended where
  it reacts to none, since nothing else tells the reader a message is what brings them in. Nothing
  while neither, and nothing for a conversation that launched no subagent, which reads none
*/
function ConversationSubagentsStrip({ conversation, run, variant }: Props) {
  const { formatMessage } = useIntl()
  const subagents = useConversationSubagents(conversation.id, { isEnabled: conversation.subagentCount > 0 })
  const stopConversationSubagents = useStopConversationSubagents()
  const [isStopping, setIsStopping] = useState(false)
  const { workingCount, isStoppable, waitingReportCount } = getConversationSubagentsSummary(subagents.data, run)

  if (!workingCount && !waitingReportCount) return null

  async function stopAll() {
    setIsStopping(true)

    try {
      await stopConversationSubagents(conversation.id)
    } catch (error) {
      console.error('The subagents could not be stopped', error)

      toast.error(formatMessage(conversationMessages.subagentsStopAllError))
    } finally {
      setIsStopping(false)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xs border border-border bg-neutral-50',
        variant === 'page' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs',
      )}
    >
      {workingCount ? (
        <div className="flex min-h-8 items-center gap-2">
          <Spinner
            size="sm"
            tone="muted"
          />
          <span className="min-w-0 flex-1 text-foreground">
            {formatMessage(conversationMessages.subagentsWorking, { count: workingCount })}
          </span>
          {isStoppable ? (
            <Button
              variant="transparent"
              size="sm"
              icon={isStopping ? <Spinner tone="current" /> : undefined}
              disabled={isStopping}
              onMouseDown={event => event.preventDefault()}
              onClick={stopAll}
            >
              {formatMessage(conversationMessages.subagentsStopAll)}
            </Button>
          ) : null}
        </div>
      ) : null}
      {waitingReportCount ? (
        <div
          role="status"
          className="flex min-h-8 items-center gap-2 text-muted-foreground"
        >
          <InboxIcon className="size-4 flex-none" />
          <span className="min-w-0 flex-1">
            {formatMessage(conversationMessages.subagentsReportsWaiting, { count: waitingReportCount })}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default ConversationSubagentsStrip
