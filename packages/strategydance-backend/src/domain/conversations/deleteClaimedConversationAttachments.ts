import { deleteConversationAttachments, getConversationPruneAttachments } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import buildConversationStoragePrefix from '~utils/buildConversationStoragePrefix'
import buildPendingAttachmentObjectName from '~utils/buildPendingAttachmentObjectName'
import logger from '~utils/logger'

import conversationClaudeFiles from '~domain/agent/conversationClaudeFiles'
import conversationAttachmentStorage from '~domain/conversations/conversationAttachmentStorage'

// A conversation a prune claimed, by what its files are found by
type ClaimedConversation = {
  id: string
  userId: string
  organizationId: string
}

/*
  Deletes the files of a conversation the daily sweep claimed, before its rows go, which would set
  their message to null and leave them looking unsent: its author's files in its organization,
  sent and not, since another member who learned a draft's id could have uploaded under it. Their
  files in the Files API first, each failure logged, since the sweep deletes a file no row names a
  day later anyway, then the conversation's folder and whatever of their pending objects the bucket's
  lifecycle rule has not deleted yet, then their rows. Throws when Storage fails, which leaves the conversation claimed for the
  next sweep
*/
async function deleteClaimedConversationAttachments({
  id: conversationId,
  userId,
  organizationId,
}: ClaimedConversation) {
  const location = { organizationId, userId, conversationId }
  const { data } = await getConversationPruneAttachments(dataConnect, location)

  for (const { claudeFileId } of data.conversationAttachments) {
    if (!claudeFileId) continue

    try {
      await conversationClaudeFiles.delete(claudeFileId)
    } catch (error) {
      logger.error(`Conversation ${conversationId}: file ${claudeFileId} is left to the sweep`, error)
    }
  }

  await conversationAttachmentStorage.deleteFolder(buildConversationStoragePrefix(location))

  for (const attachment of data.conversationAttachments) {
    await conversationAttachmentStorage.delete(
      buildPendingAttachmentObjectName({ organizationId, userId, attachmentId: attachment.id }),
    )
  }

  const { data: deletion } = await deleteConversationAttachments(dataConnect, location)

  return deletion.conversationAttachment_deleteMany
}

export default deleteClaimedConversationAttachments
