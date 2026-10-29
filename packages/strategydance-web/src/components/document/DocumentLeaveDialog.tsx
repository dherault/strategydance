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

import documentMessages from '~data/intl/messages/document'

type Props = {
  onStay: () => void
  onLeave: () => void
}

// Asked when the reader leaves a document with changes that could not be saved. Mounted only then
function DocumentLeaveDialog({ onStay, onLeave }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Dialog
      open
      onOpenChange={open => !open && onStay()}
    >
      <DialogContent
        role="alertdialog"
        closeLabel={formatMessage(documentMessages.close)}
        className="sm:max-w-[420px]"
      >
        <DialogHeader>
          <DialogTitle>{formatMessage(documentMessages.leaveTitle)}</DialogTitle>
          <DialogDescription>{formatMessage(documentMessages.leaveText)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4">
          <Button
            variant="transparent"
            onClick={onStay}
          >
            {formatMessage(documentMessages.stay)}
          </Button>
          <Button
            variant="danger"
            onClick={onLeave}
          >
            {formatMessage(documentMessages.leave)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DocumentLeaveDialog
