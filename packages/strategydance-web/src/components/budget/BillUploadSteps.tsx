import { CheckIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Progress } from 'strategydance-design-system/components/ui/Progress'
import { cn } from 'strategydance-design-system/lib/utils'

import type { BillReceiptDraft } from '~hooks/budget/useBillReceiptDraft'

import Spinner from '~components/common/Spinner'

import budgetMessages from '~data/intl/messages/budget'

const STEPS = ['uploading', 'reading', 'finding'] as const

type Props = {
  step: (typeof STEPS)[number]
  // The receipt going up, or stored once it went
  draft: BillReceiptDraft
}

/*
  The upload dialog's three steps while a receipt is read into a new bill: uploading it, with its
  progress, reading it, and finding its fields. Each one done shows a check, the one under way a
  spinner, and those to come a dot, as the prototype draws them, announced as they change
*/
function BillUploadSteps({ step, draft }: Props) {
  const { formatMessage } = useIntl()
  const current = STEPS.indexOf(step)
  const labels = [
    formatMessage(budgetMessages.uploadStepUploading, { file: draft.status === 'none' ? '' : draft.receipt.name }),
    formatMessage(budgetMessages.uploadStepReading),
    formatMessage(budgetMessages.uploadStepFinding),
  ]

  return (
    <ol
      aria-live="polite"
      className="m-0 flex list-none flex-col gap-3 p-0 py-2"
    >
      {labels.map((label, index) => (
        <li
          key={STEPS[index]}
          className={cn(
            'flex min-w-0 items-start gap-2.5 text-sm text-muted-foreground',
            index === current && 'text-secondary',
            index < current && 'text-neutral-700',
          )}
        >
          <span className="grid size-5 flex-none place-items-center">
            {index < current ? (
              <CheckIcon
                aria-hidden="true"
                className="size-4 text-success"
              />
            ) : index === current ? (
              <Spinner
                size="md"
                tone="current"
                role={undefined}
                aria-label={undefined}
                aria-hidden="true"
              />
            ) : (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-neutral-300"
              />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
            <span className="truncate">{label}</span>
            {index === current && draft.status === 'uploading' ? (
              <Progress
                value={draft.progress}
                aria-label={formatMessage(budgetMessages.receiptProgress)}
                className="h-1"
              />
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default BillUploadSteps
