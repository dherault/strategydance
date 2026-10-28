import { useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { Dialog, DialogContent } from 'strategydance-design-system/components/ui/Dialog'

import useBills from '~hooks/budget/useBills'
import useCloseBill from '~hooks/budget/useCloseBill'

import BillDialogForm from '~components/budget/BillDialogForm'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  billId: string
}

/*
  An existing bill, open in its dialog over the Budget page at its own address. Closing steps back
  to the page's entry when the page opened it, and otherwise goes to the page, on the tab it lies
  over: the Bills tab unless the address names another, once however often it is asked
  (`useCloseBill`), as a save it outlived asks again. It opens focused on itself, as a task's
  does, rather than on its name selected whole. Radix gives the focus back only to a trigger of its
  own, which an address has none of, so the dialog takes note of what had it as it opened, the row
  or the button, and gives it back there
*/
function BillDialog({ billId }: Props) {
  const { formatMessage } = useIntl()
  const close = useCloseBill()
  const { data: bills } = useBills()
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  const contentRef = useRef<HTMLDivElement>(null)

  const bill = bills.find(({ id }) => id === billId)

  // `BillBouncer` lets no other through, but a bill deleted elsewhere can go before it moves on
  if (!bill) return null

  return (
    <Dialog
      open
      onOpenChange={isOpen => {
        if (!isOpen) close()
      }}
    >
      <DialogContent
        ref={contentRef}
        closeLabel={formatMessage(budgetMessages.close)}
        className="flex max-h-[calc(100dvh-3rem)] min-w-0 flex-col gap-0 p-0 sm:max-w-[560px]"
        onOpenAutoFocus={event => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
        onCloseAutoFocus={event => {
          event.preventDefault()

          if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
        }}
      >
        <BillDialogForm
          bill={bill}
          onClose={close}
        />
      </DialogContent>
    </Dialog>
  )
}

export default BillDialog
