import {
  claimDeletedConversations,
  deleteClaimedConversations,
  getClaimedConversations,
} from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

// How many claimed conversations `GetClaimedConversations` reads at a time, its `limit`
const BATCH_SIZE = 20

// How many batches one sweep deletes at most, so it ends in bounded time: what is left goes the
// next day
const MAX_BATCHES = 50

/*
  Removes every conversation deleted over a day ago, past its Undo, whoever's it is, with its
  messages, runs and transcript, which the daily sweep does whether or not its author comes back.
  Starting a conversation prunes its author's on the way through too, which stays as the fast path.

  It first claims them all, which a restore then refuses, so an Undo and the sweep never both win,
  then deletes what is claimed, a batch at a time. Every claimed conversation is deleted, whichever
  sweep claimed it, so a sweep that failed after claiming is finished by the next. Answers how many
  it claimed and deleted
*/
async function pruneDeletedConversations() {
  const { data: claim } = await claimDeletedConversations(dataConnect)
  let deleted = 0

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data } = await getClaimedConversations(dataConnect)
    const ids = data.conversations.map(conversation => conversation.id)

    if (!ids.length) break

    const { data: deletion } = await deleteClaimedConversations(dataConnect, { ids })

    deleted += deletion.conversation_deleteMany

    if (ids.length < BATCH_SIZE) break
  }

  logger.info(`Swept deleted conversations: ${claim.conversation_updateMany} claimed, ${deleted} deleted`)

  return { claimed: claim.conversation_updateMany, deleted }
}

export default pruneDeletedConversations
