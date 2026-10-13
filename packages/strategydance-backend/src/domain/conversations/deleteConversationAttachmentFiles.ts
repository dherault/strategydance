import type { ConversationAttachmentReference } from '~types'

import buildConversationStoragePrefix from '~utils/buildConversationStoragePrefix'
import buildPendingAttachmentObjectName from '~utils/buildPendingAttachmentObjectName'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import conversationClaudeFiles from '~domain/agent/conversationClaudeFiles'
import conversationAttachmentStorage from '~domain/conversations/conversationAttachmentStorage'

/*
  Deletes everything a file left beside its row: its pending object, its copy in its conversation's
  folder when a send got as far as copying it, and its file in the Files API. Each is deleted whether
  or not it is there, so a prune that failed partway deletes the rest the next time
*/
async function deleteConversationAttachmentFiles(attachment: ConversationAttachmentReference) {
  const { organizationId, userId, conversationId, id: attachmentId, claudeFileId } = attachment

  await conversationAttachmentStorage.delete(buildPendingAttachmentObjectName({ organizationId, userId, attachmentId }))
  await conversationAttachmentStorage.delete(
    `${buildConversationStoragePrefix({ organizationId, userId, conversationId })}${toCanonicalUuid(attachmentId)}`,
  )

  if (claudeFileId) await conversationClaudeFiles.delete(claudeFileId)
}

export default deleteConversationAttachmentFiles
