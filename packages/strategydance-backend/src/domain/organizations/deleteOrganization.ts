import {
  deleteOrganization as deleteOrganizationMutation,
  getOrganizationConversationAttachmentFiles,
} from 'strategydance-database/backend'

import { bucket, dataConnect } from '~firebase'

import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import buildPendingAttachmentPrefix from '~utils/buildPendingAttachmentPrefix'
import logger from '~utils/logger'

import conversationClaudeFiles from '~domain/agent/conversationClaudeFiles'
import isAdministratorRefusal from '~domain/organizations/isAdministratorRefusal'

// How long deleting an organization spends reading its files' ids in the Files API, before its row
// goes, and deleting them, after, so the request ends well inside its time however many files it
// has: a file it never reached is one no row names once the row is gone, which the daily sweep
// deletes a day later
const CLAUDE_FILE_IDS_DURATION_MS = 20 * 1000
const CLAUDE_FILES_DURATION_MS = 60 * 1000

type DeleteOrganizationInput = {
  organizationId: string
  userId: string
}

type DeleteOrganizationResult = { outcome: 'forbidden' } | { outcome: 'deleted' }

/*
  Deletes an organization, for one of its administrators: every file under its prefix and under its
  part of `pending/`, where its members' unsent files wait, then the row, which takes its
  memberships, invitations and conversations with it, then both prefixes once more, then the files
  its conversations sent to the Files API.

  The files go first, because a download URL outlives any rule: a file left behind after the row
  would stay readable by whoever held its URL, and nobody could ask again, the route being for
  administrators of an organization that no longer exists. So a sweep that fails fails the whole
  request, with the organization still there to delete again.

  The second sweep is for an upload that raced the delete. Admitted before it, an upload can save
  its file after the first sweep and point the row at it before the row goes: swept after the row,
  that file goes too, and an upload that writes any later finds no row and deletes its own. With
  the row gone the route cannot run again, so a failure here is logged with the prefix for somebody
  to clear, and the organization reads as deleted, which it is.

  The price is a row write that fails after the sweep, which leaves the organization without its
  pictures. That takes an outage, or its administrator being demoted in the instant between the
  route's check and the mutation's, and the mark and the banner fall back to their empty looks.

  The files in the Files API are read from their rows before the rows go, but deleted only once the
  row is, since a conversation whose files Claude no longer holds fails every request: a deletion the
  database refuses keeps them. Each that fails, or is left when the time is up, is logged, and the
  daily sweep deletes it a day later, as it deletes any file no row names
*/
async function deleteOrganization({
  organizationId,
  userId,
}: DeleteOrganizationInput): Promise<DeleteOrganizationResult> {
  const prefixes = [buildOrganizationStoragePrefix(organizationId), buildPendingAttachmentPrefix(organizationId)]
  const claudeFileIds = await readClaudeFileIds(organizationId)

  // `force` carries on past a file that fails, so one cannot keep the rest, and throws after
  for (const prefix of prefixes) await bucket.deleteFiles({ prefix, force: true })

  try {
    await deleteOrganizationMutation(dataConnect, { organizationId, userId })
  } catch (error) {
    if (isAdministratorRefusal(error)) return { outcome: 'forbidden' }

    throw error
  }

  // Finds nothing unless an upload raced the delete
  for (const prefix of prefixes) {
    try {
      await bucket.deleteFiles({ prefix, force: true })
    } catch (error) {
      logger.error(`Organization deletion: could not sweep ${prefix} again after deleting its row`, error)
    }
  }

  await deleteClaudeFiles(organizationId, claudeFileIds)

  return { outcome: 'deleted' }
}

// The ids in the Files API an organization's conversation files hold, a page at a time, as many as
// its time allows
async function readClaudeFileIds(organizationId: string) {
  const ids: string[] = []
  const deadline = Date.now() + CLAUDE_FILE_IDS_DURATION_MS

  for (;;) {
    if (Date.now() >= deadline) {
      logger.warn(
        `Organization deletion: the files of ${organizationId} past the first ${ids.length} are left to the sweep`,
      )

      return ids
    }

    const { data } = await getOrganizationConversationAttachmentFiles(dataConnect, {
      organizationId,
      afterClaudeFileId: ids.at(-1) ?? '',
    })

    for (const { claudeFileId } of data.conversationAttachments) {
      if (claudeFileId) ids.push(claudeFileId)
    }

    if (data.conversationAttachments.length < 100) return ids
  }
}

// Deletes the files in the Files API, until its time is up, each failure logged for the sweep
async function deleteClaudeFiles(organizationId: string, claudeFileIds: string[]) {
  const deadline = Date.now() + CLAUDE_FILES_DURATION_MS

  for (const [index, id] of claudeFileIds.entries()) {
    if (Date.now() >= deadline) {
      logger.warn(
        `Organization deletion: ${claudeFileIds.length - index} files of ${organizationId} are left to the sweep`,
      )

      return
    }

    try {
      await conversationClaudeFiles.delete(id)
    } catch (error) {
      logger.error(`Organization deletion: file ${id} of ${organizationId} is left to the sweep`, error)
    }
  }
}

export default deleteOrganization
