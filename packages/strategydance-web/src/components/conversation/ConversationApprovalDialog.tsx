import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'

import useConversationToolCall from '~hooks/conversation/useConversationToolCall'

import formatConversationToolJson from '~utils/conversation/formatConversationToolJson'

import Spinner from '~components/common/Spinner'
import ConversationToolCallBlock from '~components/conversation/ConversationToolCallBlock'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  messageId: string
  integrationName: string
  integrationToolName: string
  onAllow: () => void
  onClose: () => void
}

/*
  What a call waiting for the reader's approval would send, whole, before they allow it: its input
  as it is stored, read as the dialog opens, laid out with every control character escaped, keys and
  nested values alike, so what reads is exactly what runs. The preview on the card is cut and
  authorizes nothing: only this dialog's Allow approves, once the input is shown
*/
function ConversationApprovalDialog({ messageId, integrationName, integrationToolName, onAllow, onClose }: Props) {
  const { formatMessage } = useIntl()
  const { data: toolCall, initialLoading, loading, hasFailed, refetch } = useConversationToolCall(messageId)
  const names = { server: integrationName, tool: integrationToolName }

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

    return (
      <ConversationToolCallBlock
        label={formatMessage(conversationMessages.toolInput)}
        value={formatConversationToolJson(toolCall.toolInput)}
      />
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
          <DialogTitle className="wrap-anywhere">
            {formatMessage(conversationMessages.approvalDialogTitle, names)}
          </DialogTitle>
          <DialogDescription>{formatMessage(conversationMessages.approvalDialogDescription)}</DialogDescription>
        </DialogHeader>
        {renderBody()}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
          >
            {formatMessage(conversationMessages.approvalDialogCancel)}
          </Button>
          <Button
            disabled={!toolCall}
            onClick={onAllow}
          >
            {formatMessage(conversationMessages.approvalAllow)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConversationApprovalDialog
