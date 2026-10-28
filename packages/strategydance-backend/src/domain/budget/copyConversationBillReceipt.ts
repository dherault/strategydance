import { randomUUID } from 'node:crypto'

import { completeBillReceiptUpload, reserveAttachmentBillReceiptForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import buildBillReceiptObjectName from '~utils/buildBillReceiptObjectName'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import billReceiptStorage from '~domain/budget/billReceiptStorage'
import { ATTACHMENT_REFUSAL } from '~domain/budget/budgetRefusalMessages'
import type { ConversationBillReceiptFile } from '~domain/budget/readConversationBillReceipt'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'

type CopyConversationBillReceiptResult =
  | { outcome: 'written'; receiptId: string }
  | { outcome: 'notMember' }
  | { outcome: 'attachmentNotFound' }

/*
  Stores a conversation's file as a bill's receipt, read by `readConversationBillReceipt`, as an
  agent's base64 receipt is stored: its row first, `UPLOADING`, under a new id, held to the member's
  sent file as read, then the file copied under it in the bucket, create-only, never sent through the
  instance, then the row `READY`, which a bill's write then takes. A file pruned meanwhile is not
  found, its row left for the sweep, which prunes it two days after, as it prunes an upload never
  saved, and so a receipt a retry its key answers leaves held by nothing
*/
async function copyConversationBillReceipt(
  caller: ModuleCaller,
  file: ConversationBillReceiptFile,
): Promise<CopyConversationBillReceiptResult> {
  const receiptId = toCanonicalUuid(randomUUID())
  const reference = { organizationId: caller.organizationId, userId: caller.userId, receiptId }

  try {
    await reserveAttachmentBillReceiptForAgent(dataConnect, {
      ...reference,
      membershipCreatedAt: caller.membershipCreatedAt,
      conversationId: file.conversationId,
      attachmentId: file.attachmentId,
      name: file.name,
      contentType: file.contentType,
      size: file.size,
    })
  } catch (error) {
    if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }
    if (isOperationRefusal(error, ATTACHMENT_REFUSAL)) return { outcome: 'attachmentNotFound' }

    throw error
  }

  const copied = await billReceiptStorage.copy(file.objectName, buildBillReceiptObjectName(reference))

  if (copied.outcome === 'missing') return { outcome: 'attachmentNotFound' }
  if (copied.outcome === 'exists' && copied.size !== file.size) {
    throw new Error(`Bill receipt ${receiptId}: its copy is not its file's size`)
  }

  await completeBillReceiptUpload(dataConnect, reference)

  return { outcome: 'written', receiptId }
}

export default copyConversationBillReceipt
