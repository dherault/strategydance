import { getSubagentPendingRuns, getSubagentSlots } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import decidePendingSubagentRun from '~domain/subagents/decidePendingSubagentRun'
import endPendingSubagentRun from '~domain/subagents/endPendingSubagentRun'
import promoteSubagentRuns from '~domain/subagents/promoteSubagentRuns'

// How many hundreds of runs the promotion skips a reconcile ends, reading them again after each
const MAX_ROUNDS = 10

type Member = Pick<ConversationRunReference, 'organizationId' | 'userId'>

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

  A run that cannot be finalized or ended is logged and left, read no more this time, so the runs
  after it and the promotion still go: the reconcile throws once done, naming how many it left, so
  its route and the sweep report it, and the next reconcile tries them again
*/
async function reconcileSubagentRuns(member: Member) {
  const { data } = await getSubagentSlots(dataConnect, member)
  const membershipCreatedAt = data.userOrganization?.createdAt ?? null
  // The runs it could not end, which it reads past from then on
  const failed = new Set<string>()

  try {
    await finalizeDeadConversationRuns(member, data.activeRuns, 'subagent-runs')
  } catch (error) {
    logger.error(`Member ${member.userId}: their dead subagent runs could not all be finalized`, error)

    failed.add('dead runs')
  }

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const runs = (await readSkippedRuns(member, membershipCreatedAt)).filter(({ id }) => !failed.has(id))

    if (!runs.length) break

    for (const run of runs) {
      const fate = decidePendingSubagentRun(run, membershipCreatedAt)

      if (fate === 'promoted') continue

      try {
        await endPendingSubagentRun({ ...member, conversationId: run.conversation.id, runId: run.id }, fate)
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

// The runs waiting for a slot that the promotion skips, oldest first: every one once the member is
// no member any more
async function readSkippedRuns(member: Member, membershipCreatedAt: string | null) {
  if (!membershipCreatedAt) return (await getSubagentSlots(dataConnect, member)).data.pendingRuns

  return (await getSubagentPendingRuns(dataConnect, { ...member, membershipCreatedAt })).data.skippedRuns
}

export default reconcileSubagentRuns
