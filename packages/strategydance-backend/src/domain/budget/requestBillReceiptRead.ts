import { addAbortSignal } from 'node:stream'

import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { BillReceiptFields } from 'strategydance-core'
import {
  BillReceiptStatus,
  claimBillReceiptRead,
  getBillReceiptForReader,
  recordBillReceiptRead,
  releaseBillReceiptRead,
} from 'strategydance-database/backend'

import type { ClaudeClient, ReachedUsageCap } from '~types'

import { IS_USAGE_CAPPED } from '~constants'

import { dataConnect } from '~firebase'

import buildBillReceiptObjectName from '~utils/buildBillReceiptObjectName'
import createConcurrencyLimit from '~utils/createConcurrencyLimit'
import logger from '~utils/logger'

import conversationClaudeClient from '~domain/agent/conversationClaudeClient'
import {
  BILL_RECEIPT_READ_TIMEOUT_MS,
  BILL_RECEIPT_READABLE_MS,
  MAX_BILL_RECEIPT_READ_IMAGE_SIZE,
  MAX_BILL_RECEIPT_TEXT_READ_BYTES,
} from '~domain/budget/billReceiptReadSettings'
import billReceiptStorage from '~domain/budget/billReceiptStorage'
import buildBillReceiptReadRequest from '~domain/budget/buildBillReceiptReadRequest'
import readBillReceiptFields from '~domain/budget/readBillReceiptFields'
import readReachedReceiptReadCap from '~domain/budget/readReachedReceiptReadCap'
import { priceClaudeMessage } from '~domain/conversations/priceConversationUsage'
import isOperationRefusal from '~domain/modules/isOperationRefusal'

/*
  The reads each instance holds a receipt's bytes for at once, so its memory stays bounded however
  many arrive together: a receipt of 10 MiB is some 40 MiB in flight, its bytes, their base64 and
  the request's JSON, and Bun collects such buffers late, so the heap is collected whole after each,
  as an upload's read-back collects it (`runUploadReadBack`)
*/
const readLimit = createConcurrencyLimit(2)

// How many times what a read found is written, should the write fail, before the member is answered
// with it anyway, its claim lapsing in two minutes
const MAX_RECORD_ATTEMPTS = 3

type RequestBillReceiptReadInput = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  receiptId: string
  // The member's today, `YYYY-MM-DD`, as the page sent it and the route checked it
  today: string
  client?: ClaudeClient
}

type RequestBillReceiptReadResult =
  | { outcome: 'read'; fields: BillReceiptFields }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The receipt is another member's, whose upload alone asks for it to be read
  | { outcome: 'notUploader' }
  // No receipt of the organization's is stored under the id
  | { outcome: 'missing' }
  // A photo past what Claude reads
  | { outcome: 'tooLarge' }
  // Uploaded over a day ago, past when a receipt can be read
  | { outcome: 'expired' }
  | { outcome: 'capped'; cap: ReachedUsageCap }
  // Another read of the same receipt is under way
  | { outcome: 'busy' }
  // Claude answered nothing the bill dialog takes, or its request failed: the receipt is let go, so
  // the member can ask again
  | { outcome: 'failed' }

/*
  Asks Claude what a bill's receipt says, for the upload dialog to fill a bill in with, once per
  receipt and only for the member who uploaded it:

  - a receipt read already answers what its read found (`readFields`), for nothing
  - else the read is held to the daily caps, read first so a read at one writes nothing, then claimed
    (`ClaimBillReceiptRead`), which counts them again under the membership's lock
  - its file is read from Storage and sent whole, the wait for a place, the read and the request all
    within 60 seconds of the claim (`BILL_RECEIPT_READ_TIMEOUT_MS`), the read's stream destroyed at
    the deadline, so the read is over, its bytes let go and its claim let go or kept, before the two
    minutes after which another read may take it over
  - an answer the bill dialog takes is kept with the receipt (`RecordBillReceiptRead`), the write
    tried again should it fail; a refusal, an answer cut at its length or past its schema, or a
    request that failed lets the claim go (`ReleaseBillReceiptRead`), so it counts toward no cap

  Its usage is logged with its model and price, since no run's ledger holds it
*/
async function requestBillReceiptRead({
  today,
  client = conversationClaudeClient,
  ...reference
}: RequestBillReceiptReadInput): Promise<RequestBillReceiptReadResult> {
  const { data } = await getBillReceiptForReader(dataConnect, reference)
  const receipt = data.billReceipt

  if (!data.userOrganization) return { outcome: 'forbidden' }

  if (!receipt || receipt.organizationId !== reference.organizationId || receipt.status !== BillReceiptStatus.READY) {
    return { outcome: 'missing' }
  }

  if (receipt.userId !== reference.userId) return { outcome: 'notUploader' }
  if (receipt.readFields) return readStored(reference.receiptId, receipt.readFields)
  if (Date.parse(receipt.createdAt) <= Date.now() - BILL_RECEIPT_READABLE_MS) return { outcome: 'expired' }

  if (receipt.contentType.startsWith('image/') && receipt.size > MAX_BILL_RECEIPT_READ_IMAGE_SIZE) {
    return { outcome: 'tooLarge' }
  }

  // This read's own claim, which its record or its release names, so a read another took over
  // touches nothing of the read that took it
  const claimed = { ...reference, readClaim: crypto.randomUUID() }
  const refusal = await claim(claimed)

  if (refusal) return refusal

  const signal = AbortSignal.timeout(BILL_RECEIPT_READ_TIMEOUT_MS)
  let message: BetaMessage

  try {
    message = await readLimit(async () => {
      try {
        signal.throwIfAborted()

        // A text receipt is read as far as the characters the request takes, never whole
        const end = receipt.contentType.startsWith('text/') ? MAX_BILL_RECEIPT_TEXT_READ_BYTES - 1 : undefined
        const bytes = await readReceiptBytes(buildBillReceiptObjectName(reference), signal, end)
        const body = buildBillReceiptReadRequest({
          file: { name: receipt.name, contentType: receipt.contentType, bytes },
          today,
          organizationName: data.userOrganization?.organization.name ?? '',
        })

        return await client.stream(body, { signal, onProgress: () => {} })
      } finally {
        Bun.gc(true)
      }
    })
  } catch (error) {
    logger.warn(`Receipt ${reference.receiptId}: its read failed${signal.aborted ? ', timed out' : ''}`, error)

    return release(claimed)
  }

  const { usage } = message

  logger.info(
    `Receipt ${reference.receiptId}: read by ${message.model}, ending on ${message.stop_reason}, ${usage.input_tokens} tokens in, ${usage.output_tokens} out, $${(priceClaudeMessage(message) / 1_000_000).toFixed(6)}`,
  )

  const fields = readBillReceiptFields(message, { today })

  if (!fields) return release(claimed)

  await record(claimed, fields)

  return { outcome: 'read', fields }
}

/*
  A receipt's bytes from Storage, up to `end` when given, streamed rather than downloaded, since a
  download takes no signal: the deadline destroys the stream, so a read that timed out holds no bytes
  past it, and its place in the limit goes with them. Each chunk is kept as Storage gave it, and the
  bytes joined once
*/
async function readReceiptBytes(objectName: string, signal: AbortSignal, end?: number) {
  const stream = addAbortSignal(signal, billReceiptStorage.openRead(objectName, { end }))
  const chunks: Buffer[] = []

  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))

  return Buffer.concat(chunks)
}

/*
  Keeps what a read found with its receipt, so asking again answers it for nothing, trying a failed
  write again rather than letting the claim go, which would pay for the read a second time. A write
  refused since the claim is gone, or still failing, leaves the member the fields all the same, and
  the claim, should it be held still, lapses in two minutes
*/
async function record(reference: BillReceiptReadClaim, fields: BillReceiptFields) {
  for (let attempt = 1; ; attempt++) {
    try {
      await recordBillReceiptRead(dataConnect, { ...reference, readFields: JSON.stringify(fields) })

      return
    } catch (error) {
      const isClaimGone = isOperationRefusal(error, 'The receipt is no longer being read')

      if (isClaimGone || attempt >= MAX_RECORD_ATTEMPTS) {
        logger.warn(`Receipt ${reference.receiptId}: what its read found could not be kept`, error)

        return
      }
    }
  }
}

type BillReceiptReadReference = {
  organizationId: string
  userId: string
  receiptId: string
}

// A reference with the id this read claimed the receipt under
type BillReceiptReadClaim = BillReceiptReadReference & { readClaim: string }

/*
  Claims the receipt for this read, or answers why it cannot be: a cap reached, read before and again
  once the claim is refused, since a cap can fill between the two; another read under way; or the
  caller no longer a member. A refusal at a cap whose window moved on meanwhile is tried once more
*/
async function claim(claimed: BillReceiptReadClaim): Promise<RequestBillReceiptReadResult | null> {
  const { readClaim, ...reference } = claimed
  const reached = await readReachedReceiptReadCap(reference)

  if (reached) return { outcome: 'capped', cap: reached }

  for (let attempt = 0; ; attempt++) {
    try {
      await claimBillReceiptRead(dataConnect, { ...reference, readClaim, isUsageCapped: IS_USAGE_CAPPED })

      return null
    } catch (error) {
      if (isOperationRefusal(error, 'Only a member of an organization')) return { outcome: 'forbidden' }

      const cap = await readReachedReceiptReadCap(reference)

      if (cap) return { outcome: 'capped', cap }

      if (isOperationRefusal(error, 'The receipt is being read')) {
        // The other read may have finished meanwhile, which answers for nothing, or the sweep removed
        // the receipt
        const { data } = await getBillReceiptForReader(dataConnect, reference)

        if (!data.billReceipt) return { outcome: 'missing' }

        const { readFields } = data.billReceipt

        return readFields ? readStored(reference.receiptId, readFields) : { outcome: 'busy' }
      }

      if (attempt > 0 || !isOperationRefusal(error, 'receipts read in 24 hours')) throw error
    }
  }
}

// What a read found and kept, which the backend wrote, so a text that is not it is a mistake, logged
function readStored(receiptId: string, readFields: string): RequestBillReceiptReadResult {
  try {
    return { outcome: 'read', fields: JSON.parse(readFields) as BillReceiptFields }
  } catch (error) {
    logger.error(`Receipt ${receiptId}: what its read found is not JSON`, error)

    return { outcome: 'failed' }
  }
}

// Lets the claim go after a read that failed, so it counts toward no cap. Should that fail too, the
// claim lapses in two minutes
async function release(reference: BillReceiptReadClaim): Promise<RequestBillReceiptReadResult> {
  try {
    await releaseBillReceiptRead(dataConnect, reference)
  } catch (error) {
    logger.warn(`Receipt ${reference.receiptId}: its claim could not be let go`, error)
  }

  return { outcome: 'failed' }
}

export default requestBillReceiptRead
