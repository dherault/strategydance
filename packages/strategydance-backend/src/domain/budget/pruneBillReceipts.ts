import { deleteBillReceipts, getPrunableBillReceipts } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import buildBillReceiptObjectName from '~utils/buildBillReceiptObjectName'
import logger from '~utils/logger'

import billReceiptStorage from '~domain/budget/billReceiptStorage'

// How many receipts `GetPrunableBillReceipts` reads at a time, its `limit`
const BATCH_SIZE = 100

// How long one sweep prunes receipts for at most, so the sweep ends in bounded time inside its
// request, the next sweep taking what is left
const MAX_DURATION_MS = 3 * 60 * 1000

/*
  The daily sweep's prune of bills' receipts no bill holds, deleted bills included, three days after
  their upload, a day after the last save that could take one: one never saved, one an edit replaced or removed, and one whose bill the sweep pruned
  just before. A batch at a time, each file deleted before its row, so no file is ever without its
  row; a receipt whose file could not be deleted keeps its row for the next sweep
*/
async function pruneBillReceipts() {
  const deadline = Date.now() + MAX_DURATION_MS
  const failed = new Set<string>()
  let deleted = 0

  while (Date.now() < deadline) {
    const { data } = await getPrunableBillReceipts(dataConnect)
    const batch = data.billReceipts.filter(({ id }) => !failed.has(id))

    if (!batch.length) break

    const gone: string[] = []

    for (const receipt of batch) {
      try {
        await billReceiptStorage.delete(
          buildBillReceiptObjectName({ organizationId: receipt.organizationId, receiptId: receipt.id }),
        )

        gone.push(receipt.id)
      } catch (error) {
        logger.error(`Bill receipt ${receipt.id}: its file could not be deleted`, error)

        failed.add(receipt.id)
      }
    }

    if (gone.length) {
      const { data: result } = await deleteBillReceipts(dataConnect, { ids: gone })

      deleted += result.billReceipt_deleteMany
    }

    if (data.billReceipts.length < BATCH_SIZE) break
  }

  logger.info(`Swept bills' receipts: ${deleted} deleted, ${failed.size} kept`)

  return { deleted, kept: failed.size }
}

export default pruneBillReceipts
