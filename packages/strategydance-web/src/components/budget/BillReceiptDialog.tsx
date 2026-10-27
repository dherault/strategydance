import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import type { BillReceiptData } from 'strategydance-core'
import { Dialog, DialogContent } from 'strategydance-design-system/components/ui/Dialog'

import BillReceiptViewer from '~components/budget/BillReceiptViewer'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  // What opens it, wrapped in a `DialogTrigger`, so the focus goes back to it once the dialog closes
  children: ReactNode
  receipt: BillReceiptData
  billName: string
  // What the description says after the file's name: the company paid and the amount, written already
  details: string[]
}

/*
  A bill's receipt, as wide as a page, 1040px at most, opened from the Bills tab or from the bill's
  own dialog. Its content mounts as it opens, so a receipt is read only once somebody looks at it
*/
function BillReceiptDialog({ children, receipt, billName, details }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Dialog>
      {children}
      <DialogContent
        closeLabel={formatMessage(budgetMessages.close)}
        className="@container flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col sm:max-w-[1040px]"
      >
        <BillReceiptViewer
          receipt={receipt}
          billName={billName}
          details={details}
        />
      </DialogContent>
    </Dialog>
  )
}

export default BillReceiptDialog
