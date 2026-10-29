import { RefreshCwIcon, UploadIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { BILL_RECEIPT_CONTENT_TYPES, type BillReceiptData } from 'strategydance-core'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button, buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { DialogDescription, DialogHeader, DialogTitle } from 'strategydance-design-system/components/ui/Dialog'
import { ImageDropzone } from 'strategydance-design-system/components/ui/ImageDropzone'

import useBillUpload, { type BillUploadRead } from '~hooks/budget/useBillUpload'

import BillUploadSteps from '~components/budget/BillUploadSteps'

import budgetMessages from '~data/intl/messages/budget'

const ACCEPT = BILL_RECEIPT_CONTENT_TYPES.join(',')

type Props = {
  onRead: (read: BillUploadRead) => void
  // Opens the bill's form to type it in, with the receipt a read failed on attached
  onManual: (receipt: BillReceiptData | null) => void
}

/*
  The upload dialog's first part, which "New bill" opens: a zone to drop the receipt or invoice in,
  or choose it, and the way to enter the bill by hand below it. Once a file is given, the three
  steps it goes through while it goes up and Strategy Dance reads it; once a read failed, what
  failed, with Try again, which asks again without uploading anything
*/
function BillUploadPanel({ onRead, onManual }: Props) {
  const { formatMessage } = useIntl()
  const { state, draft, start, retry } = useBillUpload(onRead)

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-5">
        <DialogTitle>{formatMessage(budgetMessages.newBill)}</DialogTitle>
        <DialogDescription>
          {formatMessage(
            state.status === 'working' ? budgetMessages.uploadReadingDescription : budgetMessages.uploadDescription,
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3 px-6 pb-6">
        {state.status === 'working' ? (
          <BillUploadSteps
            step={state.step}
            draft={draft}
          />
        ) : state.status === 'failed' ? (
          <Alert
            variant="danger"
            actions={
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCwIcon />}
                onClick={retry}
              >
                {formatMessage(budgetMessages.retry)}
              </Button>
            }
          >
            {formatMessage(budgetMessages.receiptReadFailed, { file: state.receipt.name })}
          </Alert>
        ) : (
          <ImageDropzone
            label={formatMessage(budgetMessages.uploadReceipt)}
            icon={<UploadIcon />}
            accept={ACCEPT}
            className="aspect-auto py-6"
            prompt={
              <span className="flex flex-col items-center gap-1">
                <span className="text-base font-semibold text-secondary">
                  {formatMessage(budgetMessages.uploadDrop)}
                </span>
                <span>{formatMessage(budgetMessages.receiptTypes)}</span>
                {/* Drawn as a button, the zone being the one control, which a click anywhere on opens */}
                <span className={buttonVariants({ variant: 'primary', size: 'sm', className: 'mt-2' })}>
                  {formatMessage(budgetMessages.uploadChooseFile)}
                </span>
              </span>
            }
            onFileSelect={start}
          />
        )}
        {state.status === 'working' ? null : (
          <Button
            variant="transparent"
            size="sm"
            className="self-center"
            onClick={() => onManual(state.status === 'failed' ? state.receipt : null)}
          >
            {formatMessage(budgetMessages.enterManually)}
          </Button>
        )}
      </div>
    </>
  )
}

export default BillUploadPanel
