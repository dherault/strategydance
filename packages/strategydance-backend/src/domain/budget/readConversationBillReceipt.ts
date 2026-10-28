import { BILL_RECEIPT_CONTENT_TYPES, MAX_BILL_RECEIPT_PDF_PAGES, MAX_BILL_RECEIPT_SIZE } from 'strategydance-core'
import { getConversationAttachmentForAgent } from 'strategydance-database/backend'

import type { ModuleCaller } from '~types'

import { dataConnect } from '~firebase'

import buildConversationStoragePrefix from '~utils/buildConversationStoragePrefix'
import toCanonicalUuid from '~utils/toCanonicalUuid'

// A conversation's file a receipt is copied from, as its row gives it, every id canonical
export type ConversationBillReceiptFile = {
  // The conversation that sent it: the calling one, or a subagent's parent
  conversationId: string
  attachmentId: string
  name: string
  contentType: string
  size: number
  objectName: string
}

type ReadConversationBillReceiptResult =
  | { outcome: 'read'; file: ConversationBillReceiptFile }
  | { outcome: 'notMember' }
  | { outcome: 'attachmentUnavailable' }
  | { outcome: 'attachmentNotFound' }
  | { outcome: 'invalidReceipt'; reason: string }

/*
  The file Strategy Dance's agent names as a bill's receipt, by its id: one the member sent in the
  conversation calling, the caller's launcher, or, for a subagent, one of its parent's that its brief
  lists, since a subagent is sent no file of its own. Any other, and one gone, is not found.

  Judged as a receipt on its row alone: its upload checked its bytes as a receipt's are, a PDF read
  unencrypted and text in UTF-8 with no NUL, and recorded its pages, so a GIF, which no receipt
  comes as, and a PDF past a receipt's 20 pages are refused without reading the file
*/
async function readConversationBillReceipt(
  caller: ModuleCaller,
  attachmentId: string,
): Promise<ReadConversationBillReceiptResult> {
  if (!caller.launcher) return { outcome: 'attachmentUnavailable' }

  const conversationId = toCanonicalUuid(caller.launcher.conversationId)
  const { data } = await getConversationAttachmentForAgent(dataConnect, {
    organizationId: caller.organizationId,
    userId: caller.userId,
    membershipCreatedAt: caller.membershipCreatedAt,
    conversationId,
    attachmentId,
  })

  if (!data.membership.length) return { outcome: 'notMember' }

  const [conversation] = data.conversations
  const [file] = data.attachments

  if (!conversation || conversation.deletedAt || !file) return { outcome: 'attachmentNotFound' }

  const senderId = conversation.parentId ? toCanonicalUuid(conversation.parentId) : conversationId
  const isHanded =
    !conversation.parentId
    || (conversation.briefs[0]?.attachmentIds ?? []).some(id => toCanonicalUuid(id) === attachmentId)

  if (toCanonicalUuid(file.conversationId) !== senderId || !isHanded) return { outcome: 'attachmentNotFound' }

  if (!(BILL_RECEIPT_CONTENT_TYPES as readonly string[]).includes(file.contentType)) {
    return {
      outcome: 'invalidReceipt',
      reason: `A receipt is a PDF, a text or a JPEG, PNG or WebP photo, and this file is ${file.contentType === 'image/gif' ? 'a GIF' : file.contentType}`,
    }
  }

  if (file.size > MAX_BILL_RECEIPT_SIZE) {
    return { outcome: 'invalidReceipt', reason: `A receipt is at most ${MAX_BILL_RECEIPT_SIZE / 1024 / 1024} MiB` }
  }

  if (file.contentType === 'application/pdf' && (file.pageCount ?? 0) > MAX_BILL_RECEIPT_PDF_PAGES) {
    return { outcome: 'invalidReceipt', reason: `A receipt's PDF has at most ${MAX_BILL_RECEIPT_PDF_PAGES} pages` }
  }

  return {
    outcome: 'read',
    file: {
      conversationId: senderId,
      attachmentId,
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      objectName: `${buildConversationStoragePrefix({ organizationId: caller.organizationId, userId: caller.userId, conversationId: senderId })}${attachmentId}`,
    },
  }
}

export default readConversationBillReceipt
