import { WrenchIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { ConversationToolStatus } from 'strategydance-database/web'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

const STATUS_MESSAGES = {
  [ConversationToolStatus.RUNNING]: conversationMessages.toolStatusRunning,
  [ConversationToolStatus.FAILED]: conversationMessages.toolStatusFailed,
  [ConversationToolStatus.CANCELLED]: conversationMessages.toolStatusCancelled,
}

type Props = {
  toolName: string
  status: ConversationToolStatus
  onOpen: () => void
}

/*
  Something Strategy Dance used while answering: a bordered row with a spinner while it runs or a
  wrench, its label, a "Tool" badge, and under them the tool's name with its state unless it
  succeeded. A finished call opens its input and output, or its error
*/
function ConversationToolCall({ toolName, status, onOpen }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl
  const isFailed = status === ConversationToolStatus.FAILED
  const isFinished = isFailed || status === ConversationToolStatus.SUCCEEDED
  const statusMessage = status === ConversationToolStatus.SUCCEEDED ? null : STATUS_MESSAGES[status]

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-xs border bg-white',
        isFailed ? 'border-red-200' : 'border-border',
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5 py-2 pr-1.5 pl-2">
        <span
          className={cn(
            'grid size-7 flex-none place-items-center rounded-xs',
            isFailed ? 'bg-danger-bg text-danger' : 'bg-neutral-100 text-neutral-600',
          )}
        >
          {status === ConversationToolStatus.RUNNING ? (
            <Spinner
              size="sm"
              tone="muted"
            />
          ) : (
            <WrenchIcon className="size-4" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-secondary">
            <span className={cn('truncate', status === ConversationToolStatus.CANCELLED && 'text-muted-foreground')}>
              {getConversationToolLabel(intl, toolName, status)}
            </span>
            <Badge
              size="sm"
              variant="neutral"
              className="flex-none"
            >
              {formatMessage(conversationMessages.toolBadge)}
            </Badge>
          </span>
          <span className="truncate font-mono text-xs leading-[1.3] text-muted-foreground">
            {toolName}
            {statusMessage ? (
              <span className={cn('font-sans', isFailed && 'text-danger')}>
                <span aria-hidden="true"> · </span>
                {formatMessage(statusMessage)}
              </span>
            ) : null}
          </span>
        </span>
        {isFinished ? (
          <Button
            variant="transparent"
            size="sm"
            onClick={onOpen}
          >
            {formatMessage(isFailed ? conversationMessages.viewError : conversationMessages.viewOutput)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default ConversationToolCall
