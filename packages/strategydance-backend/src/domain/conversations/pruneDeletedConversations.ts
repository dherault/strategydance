import {
  claimDeletedConversations,
  deleteClaimedConversations,
  deleteConversationModuleCallResults,
  getClaimedConversations,
  getClaimedSubagents,
  getConversationsWithSubagents,
  pruneClaimedSubagents,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import toConversationModuleScope from '~domain/agent/toConversationModuleScope'
import deleteClaimedConversationAttachments from '~domain/conversations/deleteClaimedConversationAttachments'

// How many claimed conversations `GetClaimedConversations` reads at a time, its `limit`
const BATCH_SIZE = 20

// How many claimed subagents `GetClaimedSubagents` reads at a time, its `limit`
const SUBAGENT_BATCH_SIZE = 100

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
  scope for the same reason; then the conversations.

  Subagents go first, each parent's together, with what their module calls stored under their own
  scope, before any parent, since a parent's deletion nulls their `parent` and would leave each a
  conversation of its own: their parent's `subagentCount` is lowered by as many in the write that
  deletes them, so a parent whose retries left it at 100 launches again once they are gone. A
  subagent's files are its parent's, which go with it. A subagent is claimed only once no run holds
  it, and a parent still holding a subagent, claimed or not, is kept for the next sweep. A conversation whose files could not all be
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
    const { data } = await getClaimedSubagents(dataConnect)
    const byParent = new Map<string, string[]>()

    for (const { id, parentId } of data.conversations) {
      if (!parentId || kept.has(id)) continue

      byParent.set(parentId, [...(byParent.get(parentId) ?? []), id])
    }

    if (!byParent.size) break

    for (const [parentId, ids] of byParent) {
      try {
        const { data: results } = await deleteConversationModuleCallResults(dataConnect, {
          scopes: ids.map(toConversationModuleScope),
        })

        await pruneClaimedSubagents(dataConnect, { parentId, ids, count: ids.length })

        deletedResults += results.moduleCallResult_deleteMany
        deleted += ids.length
      } catch (error) {
        logger.error(
          `Conversation ${parentId}: its subagents could not be pruned, they are kept for the next sweep`,
          error,
        )

        for (const id of ids) kept.add(id)
      }
    }

    if (data.conversations.length < SUBAGENT_BATCH_SIZE) break
  }

  while (Date.now() < deadline) {
    const { data } = await getClaimedConversations(dataConnect)
    const ids: string[] = []
    const { data: holding } = await getConversationsWithSubagents(dataConnect, {
      ids: data.conversations.map(({ id }) => id),
    })

    // A parent whose subagents are still there, which deleting it would leave conversations of their own
    for (const { id: parentId } of holding.conversations) kept.add(parentId)

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
