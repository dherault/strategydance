import { MAX_AGENT_BILL_RECEIPT_SIZE } from 'strategydance-core'

import type { AgentBillReceipt, ModuleCaller } from '~types'

import sniffConversationAttachment from '~utils/sniffConversationAttachment'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import checkBillReceiptBytes from '~domain/budget/checkBillReceiptBytes'

// A receipt an agent handed over, as bytes ready to store
export type AgentBillReceiptFile = {
  name: string
  contentType: string
  bytes: Uint8Array
}

// What a call's receipt reads as: its bytes, checked, or the id of a conversation's file it names,
// which `storeAgentBillReceipt` reads once the call's key has not answered it
export type ReadAgentBillReceipt =
  | { outcome: 'read'; file: AgentBillReceiptFile }
  | { outcome: 'named'; attachmentId: string }

type ReadAgentBillReceiptResult =
  | ReadAgentBillReceipt
  | { outcome: 'invalidReceipt'; reason: string }
  | { outcome: 'attachmentUnavailable' }

/*
  The bytes of a receipt an agent hands the Budget module, checked as an upload's are before anything
  is reserved, so a refused one writes nothing: at most `MAX_AGENT_BILL_RECEIPT_SIZE` once decoded,
  its first bytes the type it names, a PDF of 20 pages at most that its parser reads, and text in
  UTF-8 with no NUL, kept as `text/plain`. A conversation's file is named only by a caller a claimed
  run connected, its launcher, which Strategy Dance's own agent alone has: an external agent, or a
  measurement connecting with no run, is refused one
*/
async function readAgentBillReceipt(
  caller: ModuleCaller,
  receipt: AgentBillReceipt,
): Promise<ReadAgentBillReceiptResult> {
  if ('attachmentId' in receipt) {
    if (!caller.launcher) return { outcome: 'attachmentUnavailable' }

    return { outcome: 'named', attachmentId: toCanonicalUuid(receipt.attachmentId) }
  }

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
