import { useEffect, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { BILL_RECEIPT_CONTENT_TYPES, type BillReceiptData, type BillReceiptFields } from 'strategydance-core'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import useBillReceiptDraft from '~hooks/budget/useBillReceiptDraft'
import useReadBillReceipt from '~hooks/budget/useReadBillReceipt'
import useLocalDate from '~hooks/common/useLocalDate'

import readBillReceiptReadFailure, { type BillReceiptReadFailure } from '~utils/budget/readBillReceiptReadFailure'
import readFileType from '~utils/common/readFileType'
import sleep from '~utils/common/sleep'

import budgetMessages from '~data/intl/messages/budget'

// How long "Reading the document" shows once the read is asked, then the least "Finding company,
// amount and date" shows, so neither flashes, as the prototype paces them
const READING_STEP_MS = 700
const FINDING_STEP_MIN_MS = 600

// Where a receipt's upload dialog stands: waiting for a file, working through its three steps, or
// done with a read that failed, its receipt stored, which can be asked again
type BillUploadState =
  | { status: 'choosing' }
  | { status: 'working'; step: 'uploading' | 'reading' | 'finding' }
  | { status: 'failed'; receipt: BillReceiptData }

/*
  What the read came to, for the bill's form to open with: the receipt, stored, and what was found
  in it, or why nothing was, which no asking again would change
*/
type BillUploadRead = {
  receipt: BillReceiptData
  fields: BillReceiptFields | null
  outcome: 'filled' | Exclude<BillReceiptReadFailure, 'failed'>
}

/*
  The upload dialog's work: a file dropped or chosen goes up as the bill's dialog uploads a receipt
  (`useBillReceiptDraft`), a photo fitted first, its refusals toasted, then Strategy Dance reads it,
  and `onRead` is told what it found. A file of another type never goes up. A read that failed is
  toasted and can be asked again, with no new upload. Closing the dialog aborts what is under way
*/
function useBillUpload(onRead: (read: BillUploadRead) => void) {
  const { formatMessage } = useIntl()
  const today = useLocalDate()
  const readBillReceipt = useReadBillReceipt()
  const receipt = useBillReceiptDraft(null, () => {})
  const [state, setState] = useState<BillUploadState>({ status: 'choosing' })
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  async function read(stored: BillReceiptData) {
    controllerRef.current?.abort()

    const controller = new AbortController()
    const findingAt = Date.now() + READING_STEP_MS
    const isCurrent = () => controllerRef.current === controller && !controller.signal.aborted

    controllerRef.current = controller
    setState({ status: 'working', step: 'reading' })
    sleep(READING_STEP_MS).then(() => {
      if (isCurrent()) setState({ status: 'working', step: 'finding' })
    })

    let fields: BillReceiptFields | null = null
    let failure: BillReceiptReadFailure | null = null

    try {
      fields = await readBillReceipt({ receiptId: stored.id, today, signal: controller.signal })
    } catch (error) {
      if (controller.signal.aborted) return

      console.error('A receipt could not be read', error)
      failure = readBillReceiptReadFailure(error)
    }

    await sleep(Math.max(0, findingAt + FINDING_STEP_MIN_MS - Date.now()))

    if (!isCurrent()) return

    if (failure === 'failed') {
      toast.error(formatMessage(budgetMessages.receiptReadFailed, { file: stored.name }))
      setState({ status: 'failed', receipt: stored })

      return
    }

    onRead({ receipt: stored, fields, outcome: failure ?? 'filled' })
  }

  async function start(file: File) {
    if (!readFileType(file, BILL_RECEIPT_CONTENT_TYPES)) {
      toast.error(formatMessage(budgetMessages.uploadUnsupported))

      return
    }

    setState({ status: 'working', step: 'uploading' })
    receipt.attach(file)

    const isStored = await receipt.settle()
    const held = receipt.readHeld()

    if (!isStored || held.status !== 'ready') {
      setState({ status: 'choosing' })

      return
    }

    await read(held.receipt)
  }

  function retry() {
    if (state.status === 'failed') read(state.receipt)
  }

  return { state, draft: receipt.draft, start, retry }
}

export { type BillUploadRead }

export default useBillUpload
