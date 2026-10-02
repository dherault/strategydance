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

import knowledgeMessages from '~data/intl/messages/knowledge'

type Props = {
  onStay: () => void
  onLeave: () => void
}

// Asked when the reader leaves a document with changes that could not be saved. Mounted only then
function KnowledgeLeaveDialog({ onStay, onLeave }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Dialog
      open
      onOpenChange={open => !open && onStay()}
    >
      <DialogContent
        role="alertdialog"
        closeLabel={formatMessage(knowledgeMessages.close)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>{formatMessage(knowledgeMessages.leaveTitle)}</DialogTitle>
          <DialogDescription>{formatMessage(knowledgeMessages.leaveText)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
          <Button
            variant="transparent"
            onClick={onStay}
          >
            {formatMessage(knowledgeMessages.stay)}
          </Button>
          <Button
            variant="danger"
            onClick={onLeave}
          >
            {formatMessage(knowledgeMessages.leave)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default KnowledgeLeaveDialog
