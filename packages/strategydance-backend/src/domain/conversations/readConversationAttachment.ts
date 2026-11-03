import {
  ConversationAttachmentStatus,
  getConversationAttachment,
  getSentConversationAttachment,
} from 'strategydance-database/backend'

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
  Where a file is kept, for the route that serves its bytes: stored, in that conversation and
  organization. A sent one is any member's to read, since every member reads every conversation of
  the organization, and is read from its conversation's folder, its author's, only while that
  conversation is not deleted. An unsent one is its uploader's alone, read from where it waits. The
  caller's membership is checked before, by the route, on every read, which a Storage rule could not
  do: it would know only the uid, which a member removed keeps
*/
async function readConversationAttachment(
  location: ConversationAttachmentLocation,
): Promise<ReadConversationAttachmentResult> {
  const { organizationId, conversationId, attachmentId } = location
  const sent = await getSentConversationAttachment(dataConnect, { organizationId, conversationId, attachmentId })
  const [sentAttachment] = sent.data.conversationAttachments
  const { conversation } = sent.data

  if (sentAttachment) {
    if (
      sentAttachment.status !== ConversationAttachmentStatus.READY
      || !conversation
      || conversation.organizationId !== organizationId
      || conversation.userId !== sentAttachment.userId
      || conversation.deletedAt
    ) {
      return { outcome: 'missing' }
    }

    return {
      outcome: 'found',
      objectName: `${buildConversationStoragePrefix({ organizationId, userId: conversation.userId, conversationId })}${toCanonicalUuid(attachmentId)}`,
      name: sentAttachment.name,
      contentType: sentAttachment.contentType,
      size: sentAttachment.size,
    }
  }

  const { data } = await getConversationAttachment(dataConnect, location)
  const [attachment] = data.conversationAttachments

  if (!attachment || attachment.status !== ConversationAttachmentStatus.READY || attachment.messageId) {
    return { outcome: 'missing' }
  }

  return {
    outcome: 'found',
    objectName: buildPendingAttachmentObjectName(location),
    name: attachment.name,
    contentType: attachment.contentType,
    size: attachment.size,
  }
}

export default readConversationAttachment
