import { useIntl } from 'react-intl'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'

import type { RetriedSubagents } from '~utils/conversation/countRetriedSubagents'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  retriedSubagents: RetriedSubagents
  onConfirm: () => void
  onClose: () => void
}

/*
  What Retry asks first when the response it removes launched subagents: how many it discards, with
  their reports, which the conversation then never reads, how many of them it stops first, and that
  what they changed stays, since a retry undoes no write. A response that failed at its limits after
  a fan-out offers Retry alone, which would otherwise end the fan-out without a word
*/
function ConversationRetryDialog({ retriedSubagents: { total, working }, onConfirm, onClose }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Dialog
      open
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent
        role="alertdialog"
        closeLabel={formatMessage(conversationMessages.close)}
        className="sm:max-w-[440px]"
      >
        <DialogHeader>
          <DialogTitle>{formatMessage(conversationMessages.retryDialogTitle)}</DialogTitle>
          <DialogDescription>
            {[
              formatMessage(conversationMessages.retryDialogDiscarded, { total }),
              working
                ? formatMessage(
                    working === total
                      ? conversationMessages.retryDialogAllWorking
                      : conversationMessages.retryDialogSomeWorking,
                    { working },
                  )
                : null,
              formatMessage(conversationMessages.retryDialogKept),
            ]
              .filter(Boolean)
              .join(' ')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
          <Button
            variant="transparent"
            onClick={onClose}
          >
            {formatMessage(conversationMessages.retryDialogCancel)}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
          >
            {formatMessage(conversationMessages.retryDialogConfirm)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConversationRetryDialog
