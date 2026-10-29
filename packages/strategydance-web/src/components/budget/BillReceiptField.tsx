import { EyeIcon, FileTextIcon, ImageIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { useRef } from 'react'
import { useIntl } from 'react-intl'
import { BILL_RECEIPT_CONTENT_TYPES } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { DialogTrigger } from 'strategydance-design-system/components/ui/Dialog'
import { fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'
import { ImageDropzone } from 'strategydance-design-system/components/ui/ImageDropzone'
import { Progress } from 'strategydance-design-system/components/ui/Progress'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import type { BillReceiptDraft } from '~hooks/budget/useBillReceiptDraft'

import formatFileSize from '~utils/common/formatFileSize'

import BillReceiptDialog from '~components/budget/BillReceiptDialog'

import budgetMessages from '~data/intl/messages/budget'

// What the file pickers offer, the types a receipt goes up as
const ACCEPT = BILL_RECEIPT_CONTENT_TYPES.join(',')

type Props = {
  draft: BillReceiptDraft
  // What the receipt's dialog says of it: the bill's name, then the company and the amount
  billName: string
  details: string[]
  onAttach: (file: File) => void
  onRemove: () => void
  // While the bill saves, which carries the receipt as it was when Save was pressed
  isDisabled?: boolean
}

/*
  A bill's receipt in its dialog: a zone to drop one on or click, which takes a PDF, a text file or
  a photo; then the file's name and size, or how far its upload has gone, with View once it is
  stored, Replace and Remove, the last after a second click. Nothing changes the receipt while the
  bill saves, since the save carries the receipt it had when it started
*/
function BillReceiptField({ draft, billName, details, onAttach, onRemove, isDisabled = false }: Props) {
  const intl = useIntl()
  const { formatMessage, formatNumber } = intl
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-1.5">
      <span className={fieldLabelClassName}>{formatMessage(budgetMessages.receiptLabel)}</span>
      {draft.status === 'none' ? (
        <ImageDropzone
          label={formatMessage(budgetMessages.attachReceipt)}
          icon={<UploadIcon />}
          accept={ACCEPT}
          disabled={isDisabled}
          prompt={
            <>
              {formatMessage(budgetMessages.receiptDrop, { strong: chunks => <strong>{chunks}</strong> })}
              <span className="block text-xs">{formatMessage(budgetMessages.receiptTypes)}</span>
            </>
          }
          onFileSelect={onAttach}
        />
      ) : (
        <div className="flex items-center gap-3 rounded-xs border border-neutral-200 py-2 pr-2 pl-3">
          {draft.receipt.contentType.startsWith('image/') ? (
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
            <span className="truncate text-sm text-secondary">{draft.receipt.name}</span>
            <span className="text-xs text-muted-foreground">
              {draft.status === 'uploading'
                ? formatMessage(budgetMessages.receiptUploading, {
                    percent: formatNumber(draft.progress / 100, { style: 'percent' }),
                  })
                : formatFileSize(intl, draft.receipt.size)}
            </span>
            {draft.status === 'uploading' ? (
              <Progress
                value={draft.progress}
                aria-label={formatMessage(budgetMessages.receiptProgress)}
                className="mt-1 h-1"
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {draft.status === 'ready' ? (
              <BillReceiptDialog
                receipt={draft.receipt}
                billName={billName}
                details={details}
              >
                <Tooltip content={formatMessage(budgetMessages.viewReceipt)}>
                  <DialogTrigger asChild>
                    <Button
                      variant="transparent"
                      size="sm"
                      icon={<EyeIcon />}
                      aria-label={formatMessage(budgetMessages.viewReceipt)}
                    />
                  </DialogTrigger>
                </Tooltip>
              </BillReceiptDialog>
            ) : null}
            <Tooltip content={formatMessage(budgetMessages.replaceReceipt)}>
              <Button
                variant="transparent"
                size="sm"
                icon={<UploadIcon />}
                aria-label={formatMessage(budgetMessages.replaceReceipt)}
                disabled={isDisabled}
                onClick={() => inputRef.current?.click()}
              />
            </Tooltip>
            <Tooltip content={formatMessage(budgetMessages.removeReceipt)}>
              <Button
                variant="transparent"
                size="sm"
                icon={<Trash2Icon />}
                aria-label={formatMessage(budgetMessages.removeReceipt)}
                confirm={formatMessage(budgetMessages.removeReceiptConfirm)}
                disabled={isDisabled}
                onClick={onRemove}
              />
            </Tooltip>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            hidden
            tabIndex={-1}
            onChange={event => {
              const file = event.target.files?.[0]

              // Cleared, so choosing the same file again still fires a change
              event.target.value = ''

              if (file) onAttach(file)
            }}
          />
        </div>
      )}
    </div>
  )
}

export default BillReceiptField
