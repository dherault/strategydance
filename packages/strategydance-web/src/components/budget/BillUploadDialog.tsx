import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { Dialog, DialogContent } from 'strategydance-design-system/components/ui/Dialog'
import { cn } from 'strategydance-design-system/lib/utils'

import BillDialogForm, { type BillFormDraft } from '~components/budget/BillDialogForm'
import BillReadNotice from '~components/budget/BillReadNotice'
import BillUploadPanel from '~components/budget/BillUploadPanel'

import budgetMessages from '~data/intl/messages/budget'

// What the dialog shows: the receipt's upload, or the bill's form, empty or started from the receipt
type Stage = { status: 'upload' } | { status: 'form'; draft: BillFormDraft | null }

type Props = {
  // What opens it, wrapped in a `DialogTrigger`, so the focus goes back to it once the dialog closes
  children: ReactNode
}

/*
  A new bill's dialog, opened from the Bills tab's "New bill": the receipt or invoice first, which
  goes up and Strategy Dance reads, then the bill's form in its place, filled in from what was read,
  the receipt attached, for the member to check and save. "Enter it manually" opens the form empty.
  Each opening starts from the upload, and adding the bill closes it
*/
function BillUploadDialog({ children }: Props) {
  const { formatMessage } = useIntl()
  const [isOpen, setIsOpen] = useState(false)
  const [stage, setStage] = useState<Stage>({ status: 'upload' })
  const contentRef = useRef<HTMLDivElement>(null)

  // The form takes the place of what had the focus, which goes to the dialog, as an existing bill's
  // opens focused
  useEffect(() => {
    if (stage.status === 'form') contentRef.current?.focus()
  }, [stage])

  function changeOpen(open: boolean) {
    setIsOpen(open)

    if (open) setStage({ status: 'upload' })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={changeOpen}
    >
      {children}
      <DialogContent
        ref={contentRef}
        closeLabel={formatMessage(budgetMessages.close)}
        className={cn(
          'flex max-h-[calc(100dvh-3rem)] min-w-0 flex-col gap-0 p-0',
          stage.status === 'form' ? 'sm:max-w-[560px]' : 'sm:max-w-[480px]',
        )}
      >
        {stage.status === 'form' ? (
          <BillDialogForm
            bill={null}
            draft={stage.draft}
            onClose={() => setIsOpen(false)}
          />
        ) : (
          <BillUploadPanel
            onRead={read =>
              setStage({
                status: 'form',
                draft: {
                  receipt: read.receipt,
                  fields: read.fields,
                  notice: (
                    <BillReadNotice
                      receipt={read.receipt}
                      outcome={read.outcome}
                    />
                  ),
                },
              })
            }
            onManual={receipt =>
              setStage({ status: 'form', draft: receipt ? { receipt, fields: null, notice: null } : null })
            }
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default BillUploadDialog
