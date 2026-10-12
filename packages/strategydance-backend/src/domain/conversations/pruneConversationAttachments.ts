import { claimExpiredConversationAttachments, getPruningConversationAttachments } from 'strategydance-database/backend'

import { IS_PRODUCTION } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import deletePrunedConversationAttachments from '~domain/conversations/deletePrunedConversationAttachments'
import pruneOrphanedClaudeFiles from '~domain/conversations/pruneOrphanedClaudeFiles'

// How many claimed files `GetPruningConversationAttachments` reads at a time, its `limit`
const BATCH_SIZE = 100

// How long one sweep prunes unsent files for at most, and then looks for orphaned files in the Files
// API, each in a window of its own, so the sweep ends in bounded time inside its request and a long
// prune never takes the orphans' time
const MAX_DURATION_MS = 3 * 60 * 1000
const ORPHANS_MAX_DURATION_MS = 3 * 60 * 1000

/*
  The daily sweep's prune of conversations' files, for whoever never uploads again, whose own uploads
  would prune them: everybody's unsent files that expired, a reservation ten minutes old or a file two
  days old, claimed, then deleted with their files a batch at a time, a file whose files could not all
  be deleted left claimed for the next sweep. Then, in production alone, the files the Files API holds
  that no row names, under production's own prefix, since a developer's sweep would otherwise reach
  the files of another developer sharing the key
*/
async function pruneConversationAttachments() {
  const deadline = Date.now() + MAX_DURATION_MS
  const { data: claim } = await claimExpiredConversationAttachments(dataConnect)
  const failed = new Set<string>()
  let deleted = 0

  while (Date.now() < deadline) {
    const { data } = await getPruningConversationAttachments(dataConnect)
    const batch = data.conversationAttachments.filter(({ id }) => !failed.has(id))

    if (!batch.length) break

    const result = await deletePrunedConversationAttachments(batch)

    deleted += result.deleted.length

    for (const id of result.failed) failed.add(id)

    if (data.conversationAttachments.length < BATCH_SIZE) break
  }

  const orphans = IS_PRODUCTION ? await pruneOrphanedClaudeFiles(Date.now() + ORPHANS_MAX_DURATION_MS) : null

  logger.info(
    `Swept conversation files: ${claim.conversationAttachment_updateMany} claimed, ${deleted} deleted, ${failed.size} kept${orphans ? `, ${orphans.deleted} orphaned files deleted${orphans.isComplete ? '' : ' before the deadline'}` : ''}`,
  )

  return { claimed: claim.conversationAttachment_updateMany, deleted, kept: failed.size, orphans }
}

export default pruneConversationAttachments
