import {
  ConversationRunStatus,
  getSubagentsToStop,
  requestConversationSubagentsStop,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import isOperationRefusal from '~domain/modules/isOperationRefusal'
import endPendingSubagentRun from '~domain/subagents/endPendingSubagentRun'
import promoteSubagentRuns from '~domain/subagents/promoteSubagentRuns'
import stopQueuedSubagentRun from '~domain/subagents/stopQueuedSubagentRun'

// How many times the subagents are asked and read again, a chain swapping a run between the two
const MAX_TRIES = 4

// The refusal of a parent that is not the caller's, deleted or a subagent
const MISSING_REFUSAL = "No such conversation of the caller's"

type Parent = Omit<ConversationRunReference, 'runId'>

// Which of a parent's subagents a stop reaches: those launched on an anchor, those it names, or
// every one when it names neither
type Reach = { anchorPosition?: number; subagentIds?: string[] }

/*
  Stops a parent's live subagents, as its Stop does those launched on the stopped run's anchor, its
  Stop all every one, a row's Stop the one it names, and a retry those the runs it cuts launched: each
  run they are busy with, queued, running or waiting for a slot, is asked to stop, after the parent's
  row, the lock a launch and every cascade on a parent share. Then each queued run is ended at once,
  with its report, and the slot it held promoted into, and each run waiting for a slot ended, which
  held none. A working one ends at its worker's next step, reporting what it had.

  A chain swaps a subagent's run between the ask and the read, and the old run, `CHAINED`, is no
  longer the one to stop: the subagents are asked and read again, until every run they are busy with
  was asked. Answers `missing` for a parent that is not the caller's, deleted or a subagent, unless
  its runs were asked already, as a retry asks them in its own mutation
*/
async function stopConversationSubagents(
  parent: Parent,
  reach: Reach = {},
  { isAsked = false }: { isAsked?: boolean } = {},
): Promise<{ outcome: 'stopped' | 'missing' }> {
  const conversationId = toCanonicalUuid(parent.conversationId)
  const variables = {
    organizationId: parent.organizationId,
    userId: parent.userId,
    conversationId,
    ...(reach.anchorPosition !== undefined && { anchorPosition: reach.anchorPosition }),
    ...(reach.subagentIds && { subagentIds: reach.subagentIds.map(toCanonicalUuid) }),
  }

  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    if (!isAsked || tries > 1) {
      try {
        await requestConversationSubagentsStop(dataConnect, variables)
      } catch (error) {
        if (isOperationRefusal(error, MISSING_REFUSAL)) return { outcome: 'missing' }

        throw error
      }
    }

    const { data } = await getSubagentsToStop(dataConnect, variables)
    let isSwapped = false
    let hasFreed = false

    for (const subagent of data.conversations) {
      const [run] = subagent.latestRuns

      // Its latest run is not yet the one it is busy with, or not asked yet: a chain swapped it
      if (!run || toCanonicalUuid(run.id) !== toCanonicalUuid(subagent.activeRunId ?? '') || !run.stopRequestedAt) {
        isSwapped = true

        continue
      }

      const reference = { ...parent, conversationId: toCanonicalUuid(subagent.id), runId: toCanonicalUuid(run.id) }

      try {
        if (run.status === ConversationRunStatus.QUEUED && (await stopQueuedSubagentRun(reference))) hasFreed = true
        if (run.status === ConversationRunStatus.PENDING) await endPendingSubagentRun(reference, 'stopped')
      } catch (error) {
        // Left to its worker, which stops a queued run at its claim, and to the reconcile and the sweep
        logger.warn(`Subagent ${subagent.id}: its run asked to stop could not be ended at once`, error)
      }
    }

    if (hasFreed) {
      try {
        await promoteSubagentRuns({ organizationId: parent.organizationId, userId: parent.userId })
      } catch (error) {
        logger.warn(`Subagent runs of ${parent.userId}: a stop could not promote into the slots it freed`, error)
      }
    }

    if (!isSwapped) break
  }

  return { outcome: 'stopped' }
}

export default stopConversationSubagents
