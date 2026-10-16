import { getSubagentSlots } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import decidePendingSubagentRun from '~domain/subagents/decidePendingSubagentRun'
import endPendingSubagentRun from '~domain/subagents/endPendingSubagentRun'
import promoteSubagentRuns from '~domain/subagents/promoteSubagentRuns'

/*
  Reconciles a member's subagent runs in an organization, whatever conversation launched them, as a
  parent's page asks every two minutes and the daily sweep does for every member with one nobody
  reconciled, since no page polls a subagent's run and a dead run of another parent's holds one of
  the member's five slots:

  - each run holding a slot past its lease died with its worker, or its task never came: a queued one
    is looked up on the subagents' queue and queued again while it is under twenty minutes old, and
    any other finalized interrupted, with its report (`finalizeDeadConversationRuns`)
  - each run waiting for a slot that the promotion skips is ended, stopped when it was asked to stop
    or its subagent was deleted, interrupted when its member's membership changed or went
  - then the oldest runs waiting are promoted into the slots free, while the member still is one
*/
async function reconcileSubagentRuns(member: Pick<ConversationRunReference, 'organizationId' | 'userId'>) {
  const { data } = await getSubagentSlots(dataConnect, member)
  const membershipCreatedAt = data.userOrganization?.createdAt ?? null

  await finalizeDeadConversationRuns(member, data.activeRuns, 'subagent-runs')

  for (const run of data.pendingRuns) {
    const fate = decidePendingSubagentRun(run, membershipCreatedAt)

    if (fate !== 'promoted') {
      await endPendingSubagentRun({ ...member, conversationId: run.conversation.id, runId: run.id }, fate)
    }
  }

  if (membershipCreatedAt) await promoteSubagentRuns(member)
}

export default reconcileSubagentRuns
