import {
  claimDeletedConversations,
  deleteClaimedConversations,
  deleteConversationModuleCallResults,
  getClaimedConversations,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import toConversationModuleScope from '~domain/agent/toConversationModuleScope'
import deleteClaimedConversationAttachments from '~domain/conversations/deleteClaimedConversationAttachments'

// How many claimed conversations `GetClaimedConversations` reads at a time, its `limit`
const BATCH_SIZE = 20

// How long one sweep deletes batches for at most, so it ends in bounded time, well inside the 15
// minutes its request has with the sweep's other prunes after it: what is left goes the next day.
// A time rather than a count of batches, since the sweep is a conversation's only prune, so what it
// deletes in a day grows with what is deleted, as far as this time allows
const MAX_DURATION_MS = 5 * 60 * 1000

/*
  Removes every conversation deleted over a day ago, past its Undo, whoever's it is, with its
  messages, runs and transcript, which the daily sweep does whether or not its author comes back. It
  is the only prune: starting a conversation leaves its author's to it.

  It first claims them all, which a restore then refuses, so an Undo and the sweep never both win,
  then deletes what is claimed, a batch at a time: each conversation's files, in Storage and the Files
  API, and their rows, found by the conversation, its author and its organization, since nothing
  references the conversation from them; what its module calls stored under their keys, found by its
  scope for the same reason; then the conversations. A conversation whose files could not all be
  deleted is kept, still claimed, and every claimed conversation is deleted, whichever sweep claimed
  it, so a sweep that failed after claiming is finished by the next. Answers how many it claimed and
  deleted, and how many files and module call results went with them
*/
async function pruneDeletedConversations() {
  const { data: claim } = await claimDeletedConversations(dataConnect)
  let deleted = 0
  let deletedFiles = 0
  let deletedResults = 0
  // The conversations whose files could not all be deleted, left claimed for the next sweep
  const kept = new Set<string>()

  const deadline = Date.now() + MAX_DURATION_MS

  while (Date.now() < deadline) {
    const { data } = await getClaimedConversations(dataConnect)
    const ids: string[] = []

    for (const conversation of data.conversations) {
      if (kept.has(conversation.id)) continue

      try {
        deletedFiles += await deleteClaimedConversationAttachments(conversation)
        ids.push(conversation.id)
      } catch (error) {
        logger.error(
          `Conversation ${conversation.id}: its files could not be deleted, it is kept for the next sweep`,
          error,
        )
        kept.add(conversation.id)
      }
    }

    if (!ids.length) break

    const { data: results } = await deleteConversationModuleCallResults(dataConnect, {
      scopes: ids.map(toConversationModuleScope),
    })
    const { data: deletion } = await deleteClaimedConversations(dataConnect, { ids })

    deletedResults += results.moduleCallResult_deleteMany
    deleted += deletion.conversation_deleteMany

    if (data.conversations.length < BATCH_SIZE) break
  }

  logger.info(
    `Swept deleted conversations: ${claim.conversation_updateMany} claimed, ${deleted} deleted with ${deletedFiles} files and ${deletedResults} module call results, ${kept.size} kept`,
  )

  return { claimed: claim.conversation_updateMany, deleted, deletedFiles, deletedResults }
}

export default pruneDeletedConversations
