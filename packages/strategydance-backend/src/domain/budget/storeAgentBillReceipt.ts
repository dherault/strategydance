import type { ModuleCaller } from '~types'

import type { ReadAgentBillReceipt } from '~domain/budget/readAgentBillReceipt'

type StoreAgentBillReceiptResult =
  | { outcome: 'written'; receiptId: string }
  | { outcome: 'notMember' }
  | { outcome: 'attachmentUnavailable' }
  | { outcome: 'attachmentNotFound' }
  | { outcome: 'invalidReceipt'; reason: string }

/*
  Stores the receipt a bill's write carries, once its fields and its payer were checked and its key
  did not answer it, so a refused or answered call stores nothing: bytes an agent handed over,
  written, or a conversation's file it named, read then copied, its refusals arriving here, before
  anything is written.

  What it stores with is imported only now, since it reaches the bucket and the conversations'
  operations, which a module's tests do not load
*/
async function storeAgentBillReceipt(
  caller: ModuleCaller,
  receipt: ReadAgentBillReceipt,
): Promise<StoreAgentBillReceiptResult> {
  if (receipt.outcome === 'read') {
    const { default: writeAgentBillReceipt } = await import('~domain/budget/writeAgentBillReceipt')

    return writeAgentBillReceipt(caller, receipt.file)
  }

  const { default: readConversationBillReceipt } = await import('~domain/budget/readConversationBillReceipt')
  const read = await readConversationBillReceipt(caller, receipt.attachmentId)

  if (read.outcome !== 'read') return read

  const { default: copyConversationBillReceipt } = await import('~domain/budget/copyConversationBillReceipt')

  return copyConversationBillReceipt(caller, read.file)
}

export default storeAgentBillReceipt
