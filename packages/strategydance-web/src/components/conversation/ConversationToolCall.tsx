import { PlugIcon, WrenchIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { ConversationToolStatus } from 'strategydance-database/web'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
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
  // What the row offers beside its output, Restore for a document it deleted say
  action?: ReactNode
  // A call to an integration's: the server it went to and its tool, which name the row
  integration?: { name: string; toolName: string }
  // What became of a call that waited for the reader's approval, said in place of its status while
  // an allowed one has not run, and once a denied one never will
  approval?: 'allowed' | 'denied'
  // The strip under the row, when the server it went to does not work for the reader now
  issue?: ReactNode
}

/*
  Something Strategy Dance used while answering: a bordered row with a spinner while it runs or a
  wrench, its label, a "Tool" badge, and under them the tool's name with its state unless it
  succeeded. A call to an integration is named by its server instead, with a plug and an "MCP" badge,
  its tool's own name under them, as designed, and the strip under it when that server does not work
  for the reader now. A finished call opens its input and output, or its error, wherever the row is
  clicked but on what else it offers: its label is a button stretched over the row, under the action
*/
function ConversationToolCall({ toolName, status, onOpen, action = null, integration, approval, issue = null }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl
  const isFailed = status === ConversationToolStatus.FAILED
  const isFinished = isFailed || status === ConversationToolStatus.SUCCEEDED
  const isRunning = status === ConversationToolStatus.RUNNING && approval !== 'allowed'
  const statusMessage =
    approval === 'denied'
      ? conversationMessages.approvalStatusDenied
      : approval === 'allowed'
        ? conversationMessages.approvalStatusAllowed
        : status === ConversationToolStatus.SUCCEEDED
          ? null
          : STATUS_MESSAGES[status]

  function renderLabel() {
    const label = (
      <span
        className={cn(
          'truncate',
          status === ConversationToolStatus.CANCELLED && 'text-muted-foreground',
          action && 'max-sm:whitespace-normal',
        )}
      >
        {integration ? integration.name : getConversationToolLabel(intl, toolName, status)}
      </span>
    )

    if (!isFinished) return label

    return (
      <button
        type="button"
        aria-haspopup="dialog"
        data-tool-call-open=""
        className="flex min-w-0 cursor-pointer text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-secondary"
        onClick={onOpen}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-xs border bg-white',
        isFailed ? 'border-red-200' : 'border-border',
        isFinished && 'transition-colors duration-150 ease-in-out has-[[data-tool-call-open]:hover]:bg-neutral-50',
      )}
    >
      <div className={cn('relative flex min-w-0 items-center gap-2.5 py-2 pl-2', action ? 'pr-1.5' : 'pr-3')}>
        <span
          className={cn(
            'grid size-7 flex-none place-items-center rounded-xs',
            isFailed ? 'bg-danger-bg text-danger' : 'bg-neutral-100 text-neutral-600',
          )}
        >
          {isRunning ? (
            <Spinner
              size="sm"
              tone="muted"
            />
          ) : integration ? (
            <PlugIcon className="size-4" />
          ) : (
            <WrenchIcon className="size-4" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-secondary">
            {renderLabel()}
            {/* A row with an action of its own leaves its label the badge's room on a phone, and wraps it */}
            <Badge
              size="sm"
              variant={integration ? 'secondary' : 'neutral'}
              className={cn('flex-none', action && 'max-sm:hidden')}
            >
              {formatMessage(integration ? conversationMessages.integrationBadge : conversationMessages.toolBadge)}
            </Badge>
          </span>
          <span className="truncate font-mono text-xs leading-[1.3] text-muted-foreground">
            {integration ? integration.toolName : toolName}
            {statusMessage ? (
              <span className={cn('font-sans', isFailed && 'text-danger')}>
                <span aria-hidden="true"> · </span>
                {formatMessage(statusMessage)}
              </span>
            ) : null}
          </span>
        </span>
        {action ? <span className="relative flex-none">{action}</span> : null}
      </div>
      {issue}
    </div>
  )
}

export default ConversationToolCall
