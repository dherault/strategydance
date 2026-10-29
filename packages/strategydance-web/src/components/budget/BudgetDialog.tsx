import { type ReactNode, useState } from 'react'
import { useIntl } from 'react-intl'
import { Dialog, DialogContent } from 'strategydance-design-system/components/ui/Dialog'

import BudgetDialogForm from '~components/budget/BudgetDialogForm'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  // What opens it, wrapped in a `DialogTrigger`, so the focus goes back to it once the dialog closes
  children: ReactNode
}

/*
  The budget's settings, opened from the page's header or from an alert about the budget. Its form
  mounts with the dialog's content, so each opening starts from the budget as it stands, and a save
  or a removal closes it
*/
function BudgetDialog({ children }: Props) {
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
        className="sm:max-w-[520px]"
      >
        <BudgetDialogForm onClose={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

export default BudgetDialog
