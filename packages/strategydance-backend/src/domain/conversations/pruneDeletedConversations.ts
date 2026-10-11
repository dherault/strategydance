import {
  claimDeletedConversations,
  deleteClaimedConversations,
  deleteConversationModuleCallResults,
  getClaimedConversations,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import toConversationModuleScope from '~domain/agent/toConversationModuleScope'

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
  then deletes what is claimed, a batch at a time: what each conversation's module calls stored under
  their keys first, found by its scope since nothing references the conversation from them, then the
  conversations. Every claimed conversation is deleted, whichever sweep claimed it, so a sweep that
  failed after claiming is finished by the next. Answers how many it claimed and deleted, and how
  many module call results went with them
*/
async function pruneDeletedConversations() {
  const { data: claim } = await claimDeletedConversations(dataConnect)
  let deleted = 0
  let deletedResults = 0

  const deadline = Date.now() + MAX_DURATION_MS

  while (Date.now() < deadline) {
    const { data } = await getClaimedConversations(dataConnect)
    const ids = data.conversations.map(conversation => conversation.id)

    if (!ids.length) break

    const { data: results } = await deleteConversationModuleCallResults(dataConnect, {
      scopes: ids.map(toConversationModuleScope),
    })
    const { data: deletion } = await deleteClaimedConversations(dataConnect, { ids })

    deletedResults += results.moduleCallResult_deleteMany
    deleted += deletion.conversation_deleteMany

    if (ids.length < BATCH_SIZE) break
  }

  logger.info(
    `Swept deleted conversations: ${claim.conversation_updateMany} claimed, ${deleted} deleted with ${deletedResults} module call results`,
  )

  return { claimed: claim.conversation_updateMany, deleted, deletedResults }
}

export default pruneDeletedConversations
