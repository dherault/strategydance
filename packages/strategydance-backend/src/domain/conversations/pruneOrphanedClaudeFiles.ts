import { getConversationAttachmentsByClaudeFileIds } from 'strategydance-database/backend'

import { CLAUDE_FILE_NAME_PREFIX } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import conversationClaudeFiles from '~domain/agent/conversationClaudeFiles'

// How many files' ids are looked up at once, the query's `limit`
const BATCH_SIZE = 100

// How old a file has to be before it can be an orphan: an upload sends its file to the Files API a
// moment before its row names it
const MIN_AGE_MS = 24 * 60 * 60 * 1000

/*
  Deletes the files the Files API holds that no row names, which an upload leaves when it fails, or
  a retry wins, between sending its file and its row's write: only this environment's, named after
  it, since development and production share one workspace, and only those over a day old. The
  listing goes newest first, through every file, until the deadline, and answers how many it
  deleted and whether it read them all. A file it cannot delete is logged and left for the next
  sweep, and a listing that fails ends the pass, so neither keeps the sweep's later prunes from
  running.

  Newest first is the order an orphan needs: one is made by an upload, so each daily sweep meets it
  among the files one to two days old, right after the day's own uploads, however many older files
  lie past its deadline. Only a day's uploads outlasting the deadline, or sweeps missed for days,
  would leave one deeper, where a sweep that reads everything reaches it
*/
async function pruneOrphanedClaudeFiles(deadline: number) {
  let deleted = 0
  let batch: string[] = []

  async function deleteUnnamed() {
    const { data } = await getConversationAttachmentsByClaudeFileIds(dataConnect, { claudeFileIds: batch })
    const named = new Set(data.conversationAttachments.map(({ claudeFileId }) => claudeFileId))

    for (const id of batch) {
      if (named.has(id)) continue

      try {
        await conversationClaudeFiles.delete(id)
        deleted++
      } catch (error) {
        logger.error(`Orphaned Claude file ${id} could not be deleted, it is left for the next sweep`, error)
      }
    }

    batch = []
  }

  try {
    for await (const file of conversationClaudeFiles.list()) {
      if (Date.now() >= deadline) return { deleted, isComplete: false }

      if (!file.name.startsWith(CLAUDE_FILE_NAME_PREFIX) || Date.now() - Date.parse(file.createdAt) < MIN_AGE_MS) {
        continue
      }

      batch.push(file.id)

      if (batch.length === BATCH_SIZE) await deleteUnnamed()
    }

    if (batch.length) await deleteUnnamed()
  } catch (error) {
    logger.error('The Files API could not be listed, its orphaned files are left for the next sweep', error)

    return { deleted, isComplete: false }
  }

  return { deleted, isComplete: true }
}

export default pruneOrphanedClaudeFiles
