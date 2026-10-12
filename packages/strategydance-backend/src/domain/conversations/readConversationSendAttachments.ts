import {
  MAX_CONVERSATION_ATTACHMENTS,
  MAX_CONVERSATION_ATTACHMENTS_SIZE,
  MAX_CONVERSATION_IMAGES,
  MAX_CONVERSATION_PDF_PAGES_TOTAL,
} from 'strategydance-core'
import { ConversationAttachmentStatus, getConversationSendAttachments } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

// A file a message sends, as its upload stored it
export type ConversationSendAttachment = {
  id: string
  name: string
  contentType: string
  size: number
  pageCount: number | null
  tokenCount: number
  claudeFileId: string
  createdAt: string
}

type ConversationSendAttachmentsLocation = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  conversationId: string
  attachmentIds: string[]
}

type ReadConversationSendAttachmentsResult =
  | { outcome: 'read'; attachments: ConversationSendAttachment[] }
  // A file is not the caller's in this conversation, not stored yet, or sent already
  | { outcome: 'invalid' }
  | { outcome: 'overBudget'; reason: string }

/*
  The files a message sends, in the order it sends them, by when they were uploaded, then by their
  ids, which the transcript and the thread both follow: each the caller's in this conversation and
  organization, stored and not sent. Held to what the conversation may hold with the files it sent:
  100 files, 20 images, 15 MiB and 300 PDF pages, summed from what each upload kept, so no file is
  read again
*/
async function readConversationSendAttachments({
  attachmentIds,
  ...location
}: ConversationSendAttachmentsLocation): Promise<ReadConversationSendAttachmentsResult> {
  const { data } = await getConversationSendAttachments(dataConnect, { ...location, attachmentIds })
  const attachments: ConversationSendAttachment[] = []

  for (const attachmentId of attachmentIds) {
    const attachment = data.named.find(({ id }) => id === attachmentId)

    if (
      !attachment
      || attachment.status !== ConversationAttachmentStatus.READY
      || attachment.messageId
      || !attachment.claudeFileId
      || typeof attachment.tokenCount !== 'number'
    ) {
      return { outcome: 'invalid' }
    }

    attachments.push({
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      pageCount: attachment.pageCount ?? null,
      tokenCount: attachment.tokenCount,
      claudeFileId: attachment.claudeFileId,
      createdAt: attachment.createdAt,
    })
  }

  const held = [...data.sent, ...attachments]

  if (held.length > MAX_CONVERSATION_ATTACHMENTS) {
    return { outcome: 'overBudget', reason: `A conversation holds at most ${MAX_CONVERSATION_ATTACHMENTS} files` }
  }

  if (held.filter(({ contentType }) => contentType.startsWith('image/')).length > MAX_CONVERSATION_IMAGES) {
    return { outcome: 'overBudget', reason: `A conversation holds at most ${MAX_CONVERSATION_IMAGES} images` }
  }

  if (held.reduce((total, { size }) => total + size, 0) > MAX_CONVERSATION_ATTACHMENTS_SIZE) {
    return {
      outcome: 'overBudget',
      reason: `A conversation's files hold at most ${MAX_CONVERSATION_ATTACHMENTS_SIZE} bytes`,
    }
  }

  if (held.reduce((total, { pageCount }) => total + (pageCount ?? 0), 0) > MAX_CONVERSATION_PDF_PAGES_TOTAL) {
    return {
      outcome: 'overBudget',
      reason: `A conversation's PDFs have at most ${MAX_CONVERSATION_PDF_PAGES_TOTAL} pages`,
    }
  }

  return {
    outcome: 'read',
    attachments: attachments.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
  }
}

export default readConversationSendAttachments
