import { deletePrunedConversationAttachments as deletePrunedConversationAttachmentsMutation } from 'strategydance-database/backend'

import type { ConversationAttachmentReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import deleteConversationAttachmentFiles from '~domain/conversations/deleteConversationAttachmentFiles'

/*
  Deletes unsent files a prune claimed: each one's files first, then the rows of those whose files
  went. A row whose files could not all be deleted stays claimed, and still counted against its
  member's files, for the next prune to finish. Answers the ids it deleted and those it left
*/
async function deletePrunedConversationAttachments(attachments: ConversationAttachmentReference[]) {
  const deleted: string[] = []
  const failed: string[] = []

  for (const attachment of attachments) {
    try {
      await deleteConversationAttachmentFiles(attachment)

      deleted.push(attachment.id)
    } catch (error) {
      logger.error(`Conversation attachment ${attachment.id}: its files could not be deleted`, error)

      failed.push(attachment.id)
    }
  }

  if (deleted.length) await deletePrunedConversationAttachmentsMutation(dataConnect, { ids: deleted })

  return { deleted, failed }
}

export default deletePrunedConversationAttachments
