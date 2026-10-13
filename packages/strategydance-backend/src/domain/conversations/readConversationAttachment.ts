import { ConversationAttachmentStatus, getConversationAttachment } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import buildConversationStoragePrefix from '~utils/buildConversationStoragePrefix'
import buildPendingAttachmentObjectName from '~utils/buildPendingAttachmentObjectName'
import toCanonicalUuid from '~utils/toCanonicalUuid'

type ConversationAttachmentLocation = {
  // Canonical, as `toCanonicalUuid` writes them, and the caller's uid as the backend verified it
  organizationId: string
  userId: string
  conversationId: string
  attachmentId: string
}

type ReadConversationAttachmentResult =
  | { outcome: 'found'; objectName: string; name: string; contentType: string; size: number }
  | { outcome: 'missing' }

/*
  Where a file of the caller's is kept, for the route that serves its bytes: their own, stored, in
  that conversation and organization. A sent one is read from its conversation's folder, and only
  while that conversation is still theirs and not deleted; an unsent one from where it waits. The
  caller's membership is checked before, by the route, on every read, which a Storage rule could not
  do: it would know only the uid, which a member removed keeps
*/
async function readConversationAttachment(
  location: ConversationAttachmentLocation,
): Promise<ReadConversationAttachmentResult> {
  const { organizationId, userId, conversationId, attachmentId } = location
  const { data } = await getConversationAttachment(dataConnect, location)
  const [attachment] = data.conversationAttachments
  const { conversation } = data

  if (!attachment || attachment.status !== ConversationAttachmentStatus.READY) return { outcome: 'missing' }

  const file = { name: attachment.name, contentType: attachment.contentType, size: attachment.size }

  if (!attachment.messageId) {
    return { outcome: 'found', objectName: buildPendingAttachmentObjectName(location), ...file }
  }

  if (
    !conversation
    || conversation.userId !== userId
    || conversation.organizationId !== organizationId
    || conversation.deletedAt
  ) {
    return { outcome: 'missing' }
  }

  return {
    outcome: 'found',
    objectName: `${buildConversationStoragePrefix({ organizationId, userId, conversationId })}${toCanonicalUuid(attachmentId)}`,
    ...file,
  }
}

export default readConversationAttachment
