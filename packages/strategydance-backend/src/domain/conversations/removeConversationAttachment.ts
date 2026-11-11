import { claimConversationAttachment, getConversationAttachment } from 'strategydance-database/backend'

import type { ConversationAttachmentLocation } from '~types'

import { dataConnect } from '~firebase'

import deletePrunedConversationAttachments from '~domain/conversations/deletePrunedConversationAttachments'

type RemoveConversationAttachmentResult = { outcome: 'removed' } | { outcome: 'sent' }

/*
  Removes a file the caller uploaded and has not sent, as the composer's tray does, so its place
  frees at once rather than in two days: claimed as a prune claims it, so no upload finishes it and
  no send takes it, then deleted with its files. Only their own, in that conversation and
  organization. Removing it again, or a file that never was, answers the same. A sent file is
  refused: only its conversation's deletion removes it
*/
async function removeConversationAttachment(
  location: ConversationAttachmentLocation,
): Promise<RemoveConversationAttachmentResult> {
  const { organizationId, userId, conversationId, attachmentId } = location

  await claimConversationAttachment(dataConnect, location)

  const { data } = await getConversationAttachment(dataConnect, location)
  const [attachment] = data.conversationAttachments

  if (!attachment) return { outcome: 'removed' }
  if (attachment.messageId) return { outcome: 'sent' }

  const { failed } = await deletePrunedConversationAttachments([
    { id: attachmentId, organizationId, userId, conversationId, claudeFileId: attachment.claudeFileId },
  ])

  if (failed.length) throw new Error(`Conversation attachment ${attachmentId}: its files could not be deleted`)

  return { outcome: 'removed' }
}

export default removeConversationAttachment
