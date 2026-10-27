import { DownloadIcon } from 'lucide-react'
import { ReceiptIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import type { BillReceiptData } from 'strategydance-core'
import { Button, buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { DialogDescription, DialogHeader, DialogTitle } from 'strategydance-design-system/components/ui/Dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import useBillReceiptFile from '~hooks/budget/useBillReceiptFile'
import useObjectUrl from '~hooks/common/useObjectUrl'

import BillReceiptView from '~components/budget/BillReceiptView'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  receipt: BillReceiptData
  // The bill's name, its title, or nothing yet for a new bill
  billName: string
  // What the description says after the file's name: the company paid and the amount, written already
  details: string[]
}

/*
  What the receipt's dialog holds, mounted as it opens: its header, with Download once the file is
  read, and the file. A receipt the backend no longer serves says so, with a way to read it again
*/
function BillReceiptViewer({ receipt, billName, details }: Props) {
  const { formatMessage } = useIntl()
  const { file, hasFailed, isRetrying, retry } = useBillReceiptFile(receipt.id)
  const url = useObjectUrl(file?.blob ?? null)

  return (
    <>
      <DialogHeader className="flex-row items-start gap-3 pr-8">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <DialogTitle className="truncate">{billName || formatMessage(budgetMessages.receiptTitle)}</DialogTitle>
          <DialogDescription className="wrap-anywhere">
            {[receipt.name, ...details].filter(Boolean).join(' · ')}
          </DialogDescription>
        </div>
        {url ? (
          <a
            href={url}
            download={receipt.name}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <DownloadIcon aria-hidden="true" />
            {formatMessage(budgetMessages.download)}
          </a>
        ) : null}
      </DialogHeader>
      {hasFailed ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <ReceiptIcon />
            </EmptyMedia>
            <EmptyTitle>{formatMessage(budgetMessages.receiptUnavailable)}</EmptyTitle>
            <EmptyDescription>{formatMessage(budgetMessages.receiptUnavailableText)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              disabled={isRetrying}
              onClick={retry}
            >
              {formatMessage(budgetMessages.retry)}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <BillReceiptView
          receipt={receipt}
          file={file}
          url={url}
          billName={billName}
        />
      )}
    </>
  )
}

export default BillReceiptViewer
