import { useIntl } from 'react-intl'
import { ConversationToolStatus } from 'strategydance-database/web'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'

import useConversationToolCall from '~hooks/conversation/useConversationToolCall'

import formatConversationToolJson from '~utils/conversation/formatConversationToolJson'
import getConversationToolLabel from '~utils/conversation/getConversationToolLabel'

import Spinner from '~components/common/Spinner'
import ConversationSubagentReport from '~components/conversation/ConversationSubagentReport'
import ConversationToolCallBlock from '~components/conversation/ConversationToolCallBlock'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  messageId: string
  toolName: string
  // As the thread shows it, until the call's own read lands
  status: ConversationToolStatus
  // A call to an integration's: the server it went to and its tool, which the title names
  integration?: { name: string; toolName: string }
  // A launch's: the subagent it launched, in the conversation that launched it, which the title
  // names and whose report stands for the call's output
  subagent?: { conversationId: string; id: string; title: string }
  onClose: () => void
}

/*
  What a tool Strategy Dance used was given and gave back, or how it failed, as formatted JSON with
  every control character escaped, so what reads is what ran. The line under the title says which
  tool, when it ran and for how long. Read each time it opens, since a call's output arrives after
  its row. A launch is titled after the subagent it launched, and shows what that subagent reported
  in place of the launch's own output, which only said it was queued
*/
function ConversationToolCallDialog({ messageId, toolName, status, integration, subagent, onClose }: Props) {
  const intl = useIntl()
  const { formatMessage, formatDate, formatNumber } = intl
  const { data: toolCall, initialLoading, loading, hasFailed, refetch } = useConversationToolCall(messageId)
  const currentStatus = toolCall?.toolStatus ?? status
  const isFailed = currentStatus === ConversationToolStatus.FAILED

  function getDetails() {
    const name = integration
      ? formatMessage(conversationMessages.integrationToolCall)
      : formatMessage(conversationMessages.toolCall, { name: toolName })

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
        {subagent && !isFailed ? (
          <ConversationSubagentReport
            conversationId={subagent.conversationId}
            subagentId={subagent.id}
          />
        ) : output ? (
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
          <DialogTitle>
            {subagent
              ? subagent.title
              : integration
                ? formatMessage(conversationMessages.integrationToolCallTitle, {
                    server: integration.name,
                    tool: integration.toolName,
                  })
                : getConversationToolLabel(intl, toolName, currentStatus)}
          </DialogTitle>
          <DialogDescription>{getDetails()}</DialogDescription>
        </DialogHeader>
        {renderBody()}
      </DialogContent>
    </Dialog>
  )
}

export default ConversationToolCallDialog
