import { getSubagentPendingRuns, getSubagentSlots } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'
import decidePendingSubagentRun from '~domain/subagents/decidePendingSubagentRun'
import endPendingSubagentRun from '~domain/subagents/endPendingSubagentRun'
import promoteSubagentRuns from '~domain/subagents/promoteSubagentRuns'

// How many hundreds of runs the promotion skips a reconcile ends, reading them again after each
const MAX_ROUNDS = 10

type Member = Pick<ConversationRunReference, 'organizationId' | 'userId'>

type Options = {
  // How long a finalize or an end waits after a refusal, times the refusals so far, which a test
  // brings in
  retryDelayMs?: number
}

/*
  Reconciles a member's subagent runs in an organization, whatever conversation launched them, as a
  parent's page asks every two minutes and the daily sweep does for every member with one nobody
  reconciled, since no page polls a subagent's run and a dead run of another parent's holds one of
  the member's five slots:

  - each run holding a slot past its lease died with its worker, or its task never came: a queued one
    is looked up on the subagents' queue and queued again while it is under twenty minutes old, and
    any other finalized interrupted, with its report (`finalizeDeadConversationRuns`)
  - each run waiting for a slot that the promotion skips is ended, stopped when it was asked to stop
    or its subagent was deleted, interrupted when its member's membership changed or went, a hundred
    at a time, read again until none is left
  - then the oldest runs waiting are promoted into the slots free, while the member still is one

  A run that cannot be finalized or ended is logged and left, read past from then on, the reads
  leaving it out before their limits, so the runs after it and the promotion still go: the reconcile
  throws once done, naming how many it left, so its route and the sweep report it, and the next
  reconcile tries them again
*/
async function reconcileSubagentRuns(member: Member, { retryDelayMs }: Options = {}) {
  const { data } = await getSubagentSlots(dataConnect, member)
  const membershipCreatedAt = data.userOrganization?.createdAt ?? null
  // The runs it could not finalize or end, which it reads past from then on
  const failed = new Set<string>()

  for (const run of data.activeRuns.filter(isDeadConversationRun)) {
    try {
      await finalizeDeadConversationRun(
        { ...member, conversationId: run.conversation.id, runId: run.id },
        'subagent-runs',
        { retryDelayMs },
      )
    } catch (error) {
      logger.error(
        `Subagent run ${run.id}: it could not be finalized past its lease, and is left for the next reconcile`,
        error,
      )

      failed.add(run.id)
    }
  }

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const runs = await readSkippedRuns(member, membershipCreatedAt, [...failed])

    if (!runs.length) break

    for (const run of runs) {
      const fate = decidePendingSubagentRun(run, membershipCreatedAt)

      if (fate === 'promoted') continue

      try {
        await endPendingSubagentRun({ ...member, conversationId: run.conversation.id, runId: run.id }, fate, {
          retryDelayMs,
        })
      } catch (error) {
        logger.error(`Subagent run ${run.id}: it could not be ended ${fate}, and is left for the next reconcile`, error)

        failed.add(run.id)
      }
    }
  }

  if (membershipCreatedAt) await promoteSubagentRuns(member)

  if (failed.size) {
    throw new Error(
      `Member ${member.userId}: ${failed.size} of its runs could not be ended, left for the next reconcile`,
    )
  }
}

// The runs waiting for a slot that the promotion skips, oldest first, but those given: every one
// once the member is no member any more
async function readSkippedRuns(member: Member, membershipCreatedAt: string | null, skippedIds: string[]) {
  if (!membershipCreatedAt) return (await getSubagentSlots(dataConnect, { ...member, skippedIds })).data.pendingRuns

  return (await getSubagentPendingRuns(dataConnect, { ...member, membershipCreatedAt, skippedIds })).data.skippedRuns
}

export default reconcileSubagentRuns
