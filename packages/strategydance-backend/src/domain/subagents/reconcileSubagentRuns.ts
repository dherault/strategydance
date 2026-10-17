import { getSubagentPendingRuns, getSubagentSlots } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

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
*/
async function reconcileSubagentRuns(member: Member) {
  const { data } = await getSubagentSlots(dataConnect, member)
  const membershipCreatedAt = data.userOrganization?.createdAt ?? null

  await finalizeDeadConversationRuns(member, data.activeRuns, 'subagent-runs')

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const runs = await readSkippedRuns(member, membershipCreatedAt)

    if (!runs.length) break

    for (const run of runs) {
      const fate = decidePendingSubagentRun(run, membershipCreatedAt)

      if (fate !== 'promoted') {
        await endPendingSubagentRun({ ...member, conversationId: run.conversation.id, runId: run.id }, fate)
      }
    }
  }

  if (membershipCreatedAt) await promoteSubagentRuns(member)
}

// The runs waiting for a slot that the promotion skips, oldest first: every one once the member is
// no member any more
async function readSkippedRuns(member: Member, membershipCreatedAt: string | null) {
  if (!membershipCreatedAt) return (await getSubagentSlots(dataConnect, member)).data.pendingRuns

  return (await getSubagentPendingRuns(dataConnect, { ...member, membershipCreatedAt })).data.skippedRuns
}

export default reconcileSubagentRuns
