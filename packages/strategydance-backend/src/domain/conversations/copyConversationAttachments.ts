import buildConversationStoragePrefix from '~utils/buildConversationStoragePrefix'
import buildPendingAttachmentObjectName from '~utils/buildPendingAttachmentObjectName'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import conversationAttachmentStorage from '~domain/conversations/conversationAttachmentStorage'
import type { ConversationSendAttachment } from '~domain/conversations/readConversationSendAttachments'

type ConversationFolder = {
  organizationId: string
  userId: string
  conversationId: string
}

/*
  Copies the files a message sends from where they wait into their conversation's folder, before the
  message is stored, each create-only, so a send retried copies only what is missing: a copy already
  there of the file's size counts as done. Answers whether every file was there to copy, since a
  file waiting two days is deleted by the bucket's lifecycle rule
*/
async function copyConversationAttachments(folder: ConversationFolder, attachments: ConversationSendAttachment[]) {
  const prefix = buildConversationStoragePrefix(folder)

  for (const attachment of attachments) {
    const copied = await conversationAttachmentStorage.copy(
      buildPendingAttachmentObjectName({ ...folder, attachmentId: attachment.id }),
      `${prefix}${toCanonicalUuid(attachment.id)}`,
    )

    if (copied.outcome === 'missing') return 'expired'
    if (copied.outcome === 'exists' && copied.size !== attachment.size) {
      throw new Error(`Conversation attachment ${attachment.id}: its copy is not its size`)
    }
  }

  return 'copied'
}

export default copyConversationAttachments
