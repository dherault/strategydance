import type { Readable } from 'node:stream'

import type { BillReceiptData } from 'strategydance-core'
import {
  BillReceiptStatus,
  completeBillReceiptUpload,
  getBillReceiptForMember,
  reserveBillReceipt,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import buildBillReceiptObjectName from '~utils/buildBillReceiptObjectName'
import logger from '~utils/logger'
import runUploadReadBack from '~utils/runUploadReadBack'

import billReceiptStorage from '~domain/budget/billReceiptStorage'
import checkBillReceiptBytes from '~domain/budget/checkBillReceiptBytes'
import createAttachmentUploadCheck, { AttachmentUploadRefusal } from '~domain/conversations/createAttachmentUploadCheck'
import isOperationRefusal from '~domain/modules/isOperationRefusal'

/*
  How old a reservation an upload sent again may carry on. The daily sweep deletes a receipt no bill
  holds two days after its upload, its file first, then its row, so an upload writing a file into a
  reservation that old could do so between the two and leave a file without its row. A day leaves
  the sweep a day to itself, and a retry comes within seconds
*/
const MAX_RESUMED_RESERVATION_AGE_MS = 24 * 60 * 60 * 1000

type UploadBillReceiptInput = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  receiptId: string
  // As the route checked them: the file's name, its type, and the size its `Content-Length` declared
  name: string
  contentType: string
  size: number
  body: Readable
}

type UploadBillReceiptResult =
  | { outcome: 'stored'; receipt: BillReceiptData }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The id is another receipt's, or this one's with another name, type or size, or too old to finish
  | { outcome: 'conflict' }
  | { outcome: 'unsupported'; reason: string }
  | { outcome: 'tooLarge'; reason: string }

type ExistingReceipt = {
  organizationId: string
  // Null once its uploader's account went
  userId?: string | null
  status: BillReceiptStatus
  name: string
  contentType: string
  size: number
  createdAt: string
}

/*
  Uploads a bill's receipt under the id the page made for it, so the same upload sent again stores it
  once:

  - its row is reserved, `UPLOADING`, before any byte is read, so its file is never without its row
  - its bytes stream into Storage at `organizations/{organizationId}/receipts/{id}`, create-only,
    through a check of their signature and their size, so Storage holds no file that is not what it
    claims
  - a PDF or a text file is read back, one at a time in the instance, and checked: a PDF's pages, a
    text's encoding
  - its row turns `READY`, which a bill's save and the route that serves it wait for

  An upload sent again finds its row: `READY`, it answers as the first did; `UPLOADING`, it carries on
  where the first stopped, a stored object of its size kept. One that differs in name, type or size is
  refused, since the row's never change. A file refused leaves its row `UPLOADING`, which no bill takes
  and the sweep deletes, and no object
*/
async function uploadBillReceipt(input: UploadBillReceiptInput): Promise<UploadBillReceiptResult> {
  const { organizationId, userId, receiptId } = input
  const reference = { organizationId, userId, receiptId }
  const { data } = await getBillReceiptForMember(dataConnect, reference)

  if (!data.userOrganization) return { outcome: 'forbidden' }

  let receipt: ExistingReceipt | null | undefined = data.billReceipt

  if (!receipt) {
    try {
      await reserveBillReceipt(dataConnect, {
        ...reference,
        name: input.name,
        contentType: input.contentType,
        size: input.size,
      })
    } catch (error) {
      // The same upload got there first, its row taking the key: carry on as its retry, before
      // reading the refusal as anything else
      const { data: again } = await getBillReceiptForMember(dataConnect, reference)

      receipt = again.billReceipt

      if (!receipt) {
        if (isOperationRefusal(error, 'Only a member of an organization')) return { outcome: 'forbidden' }

        throw error
      }
    }
  }

  if (receipt) {
    const existing = readExisting(receipt, input)

    if (existing) {
      input.body.resume()

      return existing
    }
  }

  const stored = await storeObject(input)

  if (stored) return stored

  return finish(input)
}

// What an upload sent again answers from the row it found, or null to carry on uploading it
function readExisting(receipt: ExistingReceipt, input: UploadBillReceiptInput): UploadBillReceiptResult | null {
  if (
    receipt.organizationId !== input.organizationId
    || receipt.userId !== input.userId
    || receipt.name !== input.name
    || receipt.contentType !== input.contentType
    || receipt.size !== input.size
  ) {
    return { outcome: 'conflict' }
  }

  if (receipt.status === BillReceiptStatus.READY) return { outcome: 'stored', receipt: toReceiptData(input) }

  if (Date.parse(receipt.createdAt) < Date.now() - MAX_RESUMED_RESERVATION_AGE_MS) return { outcome: 'conflict' }

  return null
}

// Streams the bytes into the receipt's object, create-only: answers null once they are there, or why
// they were refused
async function storeObject(input: UploadBillReceiptInput): Promise<UploadBillReceiptResult | null> {
  try {
    const written = await billReceiptStorage.write(buildBillReceiptObjectName(input), input.contentType, () =>
      input.body.pipe(createAttachmentUploadCheck({ contentType: input.contentType, size: input.size })),
    )

    if (written.outcome === 'exists') {
      input.body.resume()

      if (written.size !== input.size) return { outcome: 'conflict' }
    }

    return null
  } catch (error) {
    if (!(error instanceof AttachmentUploadRefusal)) throw error

    if (error.reason === 'unsupported') return { outcome: 'unsupported', reason: error.message }

    return { outcome: error.reason === 'tooLarge' ? 'tooLarge' : 'conflict', reason: error.message }
  }
}

/*
  Reads a PDF or a text file back and checks it, a refusal deleting its object, then turns the row
  `READY`. A row a retry finished first answers as that one did, and a row gone, its organization
  deleted meanwhile, takes this upload's object with it, which nothing would delete otherwise
*/
async function finish(input: UploadBillReceiptInput): Promise<UploadBillReceiptResult> {
  const { organizationId, userId, receiptId } = input
  const objectName = buildBillReceiptObjectName(input)

  if (!input.contentType.startsWith('image/')) {
    const check = await runUploadReadBack(async () =>
      checkBillReceiptBytes(await billReceiptStorage.read(objectName), input.contentType),
    )

    if (check.outcome !== 'checked') {
      await deleteOwnObject(objectName)

      return check
    }
  }

  try {
    await completeBillReceiptUpload(dataConnect, { organizationId, userId, receiptId })
  } catch (error) {
    // Read again before deleting anything: a write whose answer was lost may have gone through
    const { data } = await getBillReceiptForMember(dataConnect, { organizationId, userId, receiptId })

    if (data.billReceipt?.status === BillReceiptStatus.READY)
      return { outcome: 'stored', receipt: toReceiptData(input) }

    if (!data.billReceipt) {
      await deleteOwnObject(objectName)

      return { outcome: 'conflict' }
    }

    throw error
  }

  return { outcome: 'stored', receipt: toReceiptData(input) }
}

// An object no bill will hold, deleted at once. When that fails, the sweep deletes it with its row
// `UPLOADING`, or, its row gone with its organization, the log names it for somebody to clear
async function deleteOwnObject(objectName: string) {
  try {
    await billReceiptStorage.delete(objectName)
  } catch (error) {
    logger.error(`Bill receipt: ${objectName} is left to the sweep`, error)
  }
}

function toReceiptData(input: UploadBillReceiptInput): BillReceiptData {
  return { id: input.receiptId, name: input.name, contentType: input.contentType, size: input.size }
}

export default uploadBillReceipt
