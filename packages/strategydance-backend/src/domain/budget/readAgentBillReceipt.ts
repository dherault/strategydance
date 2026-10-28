import { MAX_AGENT_BILL_RECEIPT_SIZE } from 'strategydance-core'

import type { AgentBillReceipt } from '~types'

import sniffConversationAttachment from '~utils/sniffConversationAttachment'

import checkBillReceiptBytes from '~domain/budget/checkBillReceiptBytes'

// A receipt an agent handed over, as bytes ready to store
export type AgentBillReceiptFile = {
  name: string
  contentType: string
  bytes: Uint8Array
}

type ReadAgentBillReceiptResult =
  | { outcome: 'read'; file: AgentBillReceiptFile }
  | { outcome: 'invalidReceipt'; reason: string }
  | { outcome: 'attachmentUnavailable' }

/*
  The bytes of a receipt an agent hands the Budget module, checked as an upload's are before anything
  is reserved, so a refused one writes nothing: at most `MAX_AGENT_BILL_RECEIPT_SIZE` once decoded,
  its first bytes the type it names, a PDF of 20 pages at most that its parser reads, and text in
  UTF-8 with no NUL, kept as `text/plain`. A conversation's file is Strategy Dance's own agent's to
  name, from M10, and refused until then
*/
async function readAgentBillReceipt(receipt: AgentBillReceipt): Promise<ReadAgentBillReceiptResult> {
  if ('attachmentId' in receipt) return { outcome: 'attachmentUnavailable' }

  const isText = 'text' in receipt
  const contentType = isText ? 'text/plain' : receipt.contentType
  const bytes = isText ? new TextEncoder().encode(receipt.text) : new Uint8Array(Buffer.from(receipt.base64, 'base64'))

  if (bytes.length === 0) return { outcome: 'invalidReceipt', reason: 'The receipt is empty' }

  if (bytes.length > MAX_AGENT_BILL_RECEIPT_SIZE) {
    return {
      outcome: 'invalidReceipt',
      reason: `A receipt an agent hands over is at most ${MAX_AGENT_BILL_RECEIPT_SIZE / 1024} KiB once decoded, and this one is ${Math.ceil(bytes.length / 1024)} KiB: the member can upload it on the Budget page instead`,
    }
  }

  if (!sniffConversationAttachment(bytes, contentType)) {
    return { outcome: 'invalidReceipt', reason: `The receipt's bytes are not ${isText ? 'text' : contentType}` }
  }

  const check = await checkBillReceiptBytes(bytes, contentType)

  if (check.outcome !== 'checked') return { outcome: 'invalidReceipt', reason: check.reason }

  return { outcome: 'read', file: { name: receipt.name, contentType, bytes } }
}

export default readAgentBillReceipt
