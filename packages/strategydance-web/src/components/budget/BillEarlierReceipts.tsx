import { EyeIcon, FileTextIcon, ImageIcon, RotateCcwIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import type { BillReceiptData } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'
import { fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import useBillEarlierReceipts from '~hooks/budget/useBillEarlierReceipts'

import formatFileSize from '~utils/common/formatFileSize'

import BillReceiptDialog from '~components/budget/BillReceiptDialog'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  billId: string
  // The receipt the dialog holds now, which is no longer among the earlier ones once taken back
  heldId: string | null
  // What the receipt's dialog says of it: the bill's name, then the company and the amount
  billName: string
  details: string[]
  onTakeBack: (receipt: BillReceiptData) => void
}

/*
  The receipts a bill held before an edit replaced or removed them, which it keeps until it is
  pruned, newest first, under its own receipt in its dialog: each with View and Use again, which
  puts it back as the bill's receipt once the bill is saved. Nothing while the bill has none
*/
function BillEarlierReceipts({ billId, heldId, billName, details, onTakeBack }: Props) {
  const intl = useIntl()
  const { formatMessage } = intl
  const receipts = useBillEarlierReceipts(billId).filter(receipt => receipt.id !== heldId)

  if (!receipts.length) return null

  return (
    <div className="flex flex-col gap-1.5">
      <span className={fieldLabelClassName}>{formatMessage(budgetMessages.earlierReceiptsLabel)}</span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {receipts.map(receipt => (
          <li
            key={receipt.id}
            className="flex items-center gap-3 rounded-xs border border-neutral-200 py-1.5 pr-2 pl-3"
          >
            {receipt.contentType.startsWith('image/') ? (
              <ImageIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-neutral-500"
              />
            ) : (
              <FileTextIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-neutral-500"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm text-secondary">{receipt.name}</span>
              <span className="text-xs text-muted-foreground">{formatFileSize(intl, receipt.size)}</span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <BillReceiptDialog
                receipt={receipt}
                billName={billName}
                details={details}
              >
                <Tooltip content={formatMessage(budgetMessages.viewReceipt)}>
                  <DialogTrigger asChild>
                    <Button
                      variant="transparent"
                      size="sm"
                      icon={<EyeIcon />}
                      aria-label={formatMessage(budgetMessages.viewEarlierReceipt, { name: receipt.name })}
                    />
                  </DialogTrigger>
                </Tooltip>
              </BillReceiptDialog>
              <Tooltip content={formatMessage(budgetMessages.useReceiptAgain)}>
                <Button
                  variant="transparent"
                  size="sm"
                  icon={<RotateCcwIcon />}
                  aria-label={formatMessage(budgetMessages.useEarlierReceiptAgain, { name: receipt.name })}
                  onClick={() => onTakeBack(receipt)}
                />
              </Tooltip>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default BillEarlierReceipts
