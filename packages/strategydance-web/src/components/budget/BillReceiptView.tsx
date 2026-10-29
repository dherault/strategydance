import { useIntl } from 'react-intl'
import type { BillReceiptData } from 'strategydance-core'
import { Skeleton } from 'strategydance-design-system/components/ui/Skeleton'
import { cn } from 'strategydance-design-system/lib/utils'

import type { BillReceiptFile } from '~types'

import budgetMessages from '~data/intl/messages/budget'

type Props = {
  receipt: BillReceiptData
  // The file read, or null while it loads
  file: BillReceiptFile | null
  // Where the file is drawn from, which the dialog's Download takes too
  url: string | null
  billName: string
}

/*
  A receipt drawn as it was sent, in a grey well as tall as the screen allows: a PDF in the
  browser's own viewer, a photo as itself, and a text file on a white sheet of paper in the
  monospaced face, as a till prints one
*/
function BillReceiptView({ receipt, file, url, billName }: Props) {
  const { formatMessage } = useIntl()

  const isPdf = receipt.contentType === 'application/pdf'
  const wellClassName = cn(
    'flex max-h-[calc(100dvh-220px)] min-h-50 justify-center overflow-auto rounded-xs',
    isPdf ? 'p-0' : 'bg-neutral-100 p-6 @max-[480px]:p-3',
  )

  if (!file || !url) {
    return (
      <Skeleton
        aria-label={formatMessage(budgetMessages.receiptLoading)}
        className="h-[calc(100dvh-220px)] max-h-150 min-h-50 w-full"
      />
    )
  }

  if (isPdf) {
    return (
      <div className={wellClassName}>
        <iframe
          src={url}
          title={receipt.name}
          className="h-[calc(100dvh-220px)] w-full rounded-xs border border-neutral-200"
        />
      </div>
    )
  }

  if (file.text !== null) {
    return (
      <div className={wellClassName}>
        <pre className="m-0 box-border w-full max-w-110 self-start bg-white px-7 py-8 font-mono text-sm/[1.6] whitespace-pre-wrap text-secondary shadow-sm wrap-anywhere">
          {file.text}
        </pre>
      </div>
    )
  }

  return (
    <div className={wellClassName}>
      <img
        src={url}
        alt={formatMessage(budgetMessages.receiptFor, { name: billName })}
        className="h-auto max-w-full self-start shadow-sm"
      />
    </div>
  )
}

export default BillReceiptView
