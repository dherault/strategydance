import { useIntl } from 'react-intl'
import { ConversationToolStatus } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { CopyButton } from 'strategydance-design-system/components/ui/CopyButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { cn } from 'strategydance-design-system/lib/utils'

import useConversationToolCall from '~hooks/conversation/useConversationToolCall'

import formatConversationToolJson from '~utils/conversation/formatConversationToolJson'
import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'

import Spinner from '~components/common/Spinner'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  messageId: string
  toolName: string
  // As the thread shows it, until the call's own read lands
  status: ConversationToolStatus
  onClose: () => void
}

type BlockProps = {
  label: string
  value: string
  isError?: boolean
  copy?: { label: string; copiedLabel: string }
}

// One of the call's two sides, its JSON laid out to read, scrolled by the keyboard as well when long
function ConversationToolCallBlock({ label, value, isError = false, copy }: BlockProps) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="m-0 font-sans text-xs font-medium tracking-wider text-muted-foreground uppercase">{label}</h3>
        {copy ? (
          <CopyButton
            value={value}
            label={copy.label}
            copiedLabel={copy.copiedLabel}
          />
        ) : null}
      </div>
      <pre
        tabIndex={0}
        aria-label={label}
        className={cn(
          'm-0 max-h-[280px] overflow-auto rounded-xs border p-3 font-mono text-xs leading-[1.6] whitespace-pre text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary',
          isError ? 'border-red-200 bg-danger-bg' : 'border-border bg-neutral-50',
        )}
      >
        {value}
      </pre>
    </section>
  )
}

/*
  What a tool Strategy Dance used was given and gave back, or how it failed, as formatted JSON with
  every control character escaped, so what reads is what ran. The line under the title says which
  tool, when it ran and for how long. Read each time it opens, since a call's output arrives after
  its row
*/
function ConversationToolCallDialog({ messageId, toolName, status, onClose }: Props) {
  const intl = useIntl()
  const { formatMessage, formatDate, formatNumber } = intl
  const { data: toolCall, initialLoading, loading, hasFailed, refetch } = useConversationToolCall(messageId)
  const currentStatus = toolCall?.toolStatus ?? status
  const isFailed = currentStatus === ConversationToolStatus.FAILED

  function getDetails() {
    const name = formatMessage(conversationMessages.toolCall, { name: toolName })

    if (!toolCall) return name

    return [
      name,
      isFailed ? formatMessage(conversationMessages.toolStatusFailed) : null,
      formatDate(toolCall.toolStartedAt ?? toolCall.createdAt, { dateStyle: 'medium', timeStyle: 'short' }),
      typeof toolCall.toolDurationMs === 'number'
        ? formatNumber(toolCall.toolDurationMs, { style: 'unit', unit: 'millisecond' })
        : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  function renderBody() {
    if (initialLoading) {
      return (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )
    }

    if (hasFailed || !toolCall) {
      return (
        <div className="flex flex-col items-start gap-4">
          <Alert variant="danger">{formatMessage(conversationMessages.toolCallLoadError)}</Alert>
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

    const output = formatConversationToolJson(toolCall.toolOutput)

    return (
      <div className="flex min-w-0 flex-col gap-5">
        <ConversationToolCallBlock
          label={formatMessage(conversationMessages.toolInput)}
          value={formatConversationToolJson(toolCall.toolInput)}
        />
        {output ? (
          <ConversationToolCallBlock
            label={formatMessage(isFailed ? conversationMessages.toolError : conversationMessages.toolOutput)}
            value={output}
            isError={isFailed}
            copy={{
              label: formatMessage(isFailed ? conversationMessages.copyError : conversationMessages.copyOutput),
              copiedLabel: formatMessage(conversationMessages.copied),
            }}
          />
        ) : null}
      </div>
    )
  }

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        closeLabel={formatMessage(conversationMessages.close)}
        className="max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto sm:max-w-[560px]"
      >
        <DialogHeader>
          <DialogTitle>{getConversationToolLabel(intl, toolName, currentStatus)}</DialogTitle>
          <DialogDescription>{getDetails()}</DialogDescription>
        </DialogHeader>
        {renderBody()}
      </DialogContent>
    </Dialog>
  )
}

export default ConversationToolCallDialog
