import { BotIcon, HourglassIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import type { ConversationSubagent, ConversationSubagentStatus } from '~types'

import getConversationSubagentStatus from '~utils/conversation/getConversationSubagentStatus'
import { LAUNCH_SUBAGENT_TOOL_NAME } from '~utils/conversation/hasConversationMessageBody'

import Spinner from '~components/common/Spinner'
import ConversationSubagentStep from '~components/conversation/ConversationSubagentStep'
import ConversationSubagentStop from '~components/conversation/ConversationSubagentStop'

import conversationMessages from '~data/intl/messages/conversation'

const STATUS_MESSAGES = {
  queued: conversationMessages.subagentStatusQueued,
  waitingForSlot: conversationMessages.subagentStatusWaitingForSlot,
  working: conversationMessages.subagentStatusWorking,
  stopping: conversationMessages.subagentStatusStopping,
  reported: conversationMessages.subagentStatusReported,
  stopped: conversationMessages.subagentStatusStopped,
  failed: conversationMessages.subagentStatusFailed,
  interrupted: conversationMessages.subagentStatusInterrupted,
} satisfies Record<ConversationSubagentStatus, unknown>

type Props = {
  // The conversation that launched it, through which it is stopped
  conversationId: string
  subagent: ConversationSubagent
  // Opens its report, once it has one
  onOpen: () => void
  // Opens its work, its own thread, where the row is drawn somewhere that can show it
  onView?: () => void
}

/*
  A launch, drawn as the subagent it launched, live: a bordered row as a call's is, a spinner while
  it is queued or works and an hourglass while it waits for a slot, its title, a "Subagent" badge,
  and under them the tool's name with where it stands, what it is doing while it works. It offers
  Stop while it is busy and not stopping already, and View work. Once it reported, however it ended,
  the row opens its report wherever it is clicked but on what else it offers, as a finished call's
  opens its output
*/
function ConversationSubagentCall({ conversationId, subagent, onOpen, onView }: Props) {
  const { formatMessage } = useIntl()
  const status = getConversationSubagentStatus(subagent)
  const isFailed = status === 'failed'
  const isReported = subagent.reportedAt !== null
  const isBusy = status === 'queued' || status === 'working' || status === 'stopping'
  const canStop = subagent.activeRunId !== null && status !== 'stopping'

  function renderLabel() {
    const label = <span className="truncate max-sm:whitespace-normal">{subagent.title}</span>

    if (!isReported) return label

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

  function renderStatus() {
    const text = formatMessage(STATUS_MESSAGES[status])

    if (status !== 'working') return text

    return (
      <ConversationSubagentStep
        subagentId={subagent.id}
        fallback={text}
      />
    )
  }

  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col overflow-hidden rounded-xs border bg-white',
        isFailed ? 'border-red-200' : 'border-border',
        isReported && 'transition-colors duration-150 ease-in-out has-[[data-tool-call-open]:hover]:bg-neutral-50',
      )}
    >
      <div className="relative flex min-w-0 items-center gap-2.5 py-2 pr-1.5 pl-2">
        <span
          className={cn(
            'grid size-7 flex-none place-items-center rounded-xs',
            isFailed ? 'bg-danger-bg text-danger' : 'bg-neutral-100 text-neutral-600',
          )}
        >
          {isBusy ? (
            <Spinner
              size="sm"
              tone="muted"
            />
          ) : status === 'waitingForSlot' ? (
            <HourglassIcon className="size-4" />
          ) : (
            <BotIcon className="size-4" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-secondary">
            {renderLabel()}
            {/* Its actions leave its title the badge's room on a phone, and wrap it */}
            <Badge
              size="sm"
              variant="neutral"
              className="flex-none max-sm:hidden"
            >
              {formatMessage(conversationMessages.subagentBadge)}
            </Badge>
          </span>
          <span className="truncate font-mono text-xs leading-[1.3] text-muted-foreground">
            {LAUNCH_SUBAGENT_TOOL_NAME}
            <span className={cn('font-sans', isFailed && 'text-danger')}>
              <span aria-hidden="true"> · </span>
              {renderStatus()}
            </span>
          </span>
        </span>
        <span className="relative flex flex-none items-center gap-0.5">
          {canStop ? (
            <ConversationSubagentStop
              conversationId={conversationId}
              subagentId={subagent.id}
              title={subagent.title}
              className="max-sm:px-2"
            />
          ) : null}
          {onView ? (
            <Button
              variant="transparent"
              size="sm"
              aria-label={formatMessage(conversationMessages.subagentViewWorkLabel, { title: subagent.title })}
              className="max-sm:px-2"
              onClick={onView}
            >
              {formatMessage(conversationMessages.subagentViewWork)}
            </Button>
          ) : null}
        </span>
      </div>
    </div>
  )
}

export default ConversationSubagentCall
