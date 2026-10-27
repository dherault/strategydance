import { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import {
  BILL_RECEIPT_CONTENT_TYPES,
  type BillReceiptData,
  ERROR_CODE_ATTACHMENT_TOO_LARGE,
  ERROR_CODE_TOO_MANY_REQUESTS,
  ERROR_CODE_UNSUPPORTED_MEDIA_TYPE,
  MAX_BILL_RECEIPT_NAME_LENGTH,
  MAX_BILL_RECEIPT_SIZE,
} from 'strategydance-core'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useUploadBillReceipt from '~hooks/budget/useUploadBillReceipt'

import fitBillReceiptPhoto from '~utils/budget/fitBillReceiptPhoto'
import createId from '~utils/common/createId'
import readFileType from '~utils/common/readFileType'
import runImageDrawing from '~utils/common/runImageDrawing'
import toUploadName from '~utils/common/toUploadName'

import { ApiError } from '~data/api'
import budgetMessages from '~data/intl/messages/budget'

// The receipt a bill's dialog holds: none, one stored, or one going up, its progress from 0 to 100
type BillReceiptDraft =
  | { status: 'none' }
  | { status: 'ready'; receipt: BillReceiptData }
  | { status: 'uploading'; receipt: BillReceiptData; progress: number }

// An upload under way, which a new one aborts, and which a save waits on: true once it is stored
type BillReceiptUploadRun = {
  controller: AbortController
  done: Promise<boolean>
}

function toDraft(receipt: BillReceiptData | null): BillReceiptDraft {
  return receipt ? { status: 'ready', receipt } : { status: 'none' }
}

/*
  The receipt of a bill's dialog, which goes up the moment it is dropped or chosen, before the bill
  is saved: a PDF, a text file or a photo, a photo fitted within 2000 pixels as a JPEG first.
  `onChange` is told the receipt's id as it starts going up, which the form saves, and told again
  should the upload fail and the dialog go back to the receipt it held. A save waits on `settle`,
  which says whether the receipt is stored. A file of another type or too large never goes up,
  and every refusal says why in a toast. Closing the dialog aborts the upload, whose receipt,
  held by no bill, the daily sweep prunes
*/
function useBillReceiptDraft(initial: BillReceiptData | null, onChange: (receiptId: string | null) => void) {
  const { formatMessage } = useIntl()
  const uploadBillReceipt = useUploadBillReceipt()
  const [draft, setDraft] = useState<BillReceiptDraft>(() => toDraft(initial))
  const runRef = useRef<BillReceiptUploadRun | null>(null)
  // The receipt held before any upload under way, which a failed one goes back to
  const heldRef = useRef<BillReceiptDraft>(draft)

  useEffect(() => () => runRef.current?.controller.abort(), [])

  function readFailure(error: unknown) {
    const code = error instanceof ApiError ? error.code : null

    if (code === ERROR_CODE_UNSUPPORTED_MEDIA_TYPE) return budgetMessages.receiptUnsupported
    if (code === ERROR_CODE_ATTACHMENT_TOO_LARGE) return budgetMessages.receiptTooLarge
    if (code === ERROR_CODE_TOO_MANY_REQUESTS) return budgetMessages.receiptTooManyUploads

    return budgetMessages.receiptUploadFailed
  }

  async function upload(file: File, contentType: string, previous: BillReceiptDraft, signal: AbortSignal) {
    const id = createId()
    const goBack = () => {
      setDraft(previous)
      onChange(previous.status === 'none' ? null : previous.receipt.id)
    }

    setDraft({
      status: 'uploading',
      receipt: { id, name: file.name, contentType, size: file.size },
      progress: 0,
    })
    onChange(id)

    try {
      const fitted = await runImageDrawing(async () => {
        signal.throwIfAborted()

        return fitBillReceiptPhoto(file, contentType)
      })
      const fittedType = fitted === file ? contentType : fitted.type

      signal.throwIfAborted()

      if (fitted.size > MAX_BILL_RECEIPT_SIZE) {
        toast.error(formatMessage(budgetMessages.receiptTooLarge))
        goBack()

        return false
      }

      const name = toUploadName(fitted.name, formatMessage(budgetMessages.receiptTitle), MAX_BILL_RECEIPT_NAME_LENGTH)
      let progress = 0

      setDraft({ status: 'uploading', receipt: { id, name, contentType: fittedType, size: fitted.size }, progress })

      const receipt = await uploadBillReceipt({
        receiptId: id,
        name,
        contentType: fittedType,
        file: fitted,
        signal,
        onProgress: share => {
          const next = Math.floor(share * 100)

          if (next === progress) return

          progress = next
          setDraft(current =>
            current.status === 'uploading' && current.receipt.id === id ? { ...current, progress } : current,
          )
        },
      })

      heldRef.current = { status: 'ready', receipt }
      setDraft(heldRef.current)
      onChange(receipt.id)

      return true
    } catch (error) {
      if (signal.aborted) return false

      console.error('A receipt could not be uploaded', error)
      toast.error(formatMessage(readFailure(error)))
      goBack()

      return false
    }
  }

  // Uploads a file in place of whatever receipt the dialog held, which it goes back to should it fail
  function attach(file: File) {
    const contentType = readFileType(file, BILL_RECEIPT_CONTENT_TYPES)

    if (!contentType) {
      toast.error(formatMessage(budgetMessages.receiptUnsupported))

      return
    }

    runRef.current?.controller.abort()

    const controller = new AbortController()

    runRef.current = { controller, done: upload(file, contentType, heldRef.current, controller.signal) }
  }

  function remove() {
    runRef.current?.controller.abort()
    runRef.current = null
    heldRef.current = { status: 'none' }
    setDraft(heldRef.current)
    onChange(null)
  }

  // Starts over from a receipt as it now is, as the bill's dialog does once somebody saved the bill meanwhile
  function reset(receipt: BillReceiptData | null) {
    runRef.current?.controller.abort()
    runRef.current = null
    heldRef.current = toDraft(receipt)
    setDraft(heldRef.current)
  }

  // Whether the receipt is stored once its upload, the last one started, is done
  async function settle() {
    let run = runRef.current

    while (run) {
      const isStored = await run.done

      if (run === runRef.current) return isStored

      run = runRef.current
    }

    return true
  }

  return { draft, attach, remove, reset, settle }
}

export { type BillReceiptDraft }

export default useBillReceiptDraft
