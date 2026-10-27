import { type ReactNode, useState } from 'react'
import { useIntl } from 'react-intl'
import { Dialog, DialogContent } from 'strategydance-design-system/components/ui/Dialog'

import BillDialogForm from '~components/budget/BillDialogForm'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  // What opens it, wrapped in a `DialogTrigger`, so the focus goes back to it once the dialog closes
  children: ReactNode
}

/*
  A new bill's dialog, opened from the Bills tab's "New bill". Its form mounts with the dialog's
  content, so each opening starts empty, and adding the bill closes it
*/
function NewBillDialog({ children }: Props) {
  const { formatMessage } = useIntl()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      {children}
      <DialogContent
        closeLabel={formatMessage(budgetMessages.close)}
        className="flex max-h-[calc(100dvh-3rem)] min-w-0 flex-col gap-0 p-0 sm:max-w-[560px]"
      >
        <BillDialogForm
          bill={null}
          onClose={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export default NewBillDialog
