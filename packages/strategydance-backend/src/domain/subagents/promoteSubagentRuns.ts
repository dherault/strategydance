import { MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER } from 'strategydance-core'
import { getSubagentSlots, promoteSubagentRun } from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import enqueueRun from '~domain/conversations/enqueueRun'
import decidePendingSubagentRun from '~domain/subagents/decidePendingSubagentRun'

// How many times a promotion reads the slots and tries, which a refusal on each run waiting bounds
const MAX_ROUNDS = 2 * MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER

/*
  Promotes a member's subagent runs waiting for a slot in an organization into the slots free
  there, oldest first, one at a time, each queued on the subagents' queue once promoted, until no
  slot is free or no run waits, and answers the runs it promoted. Only a run that may be promoted
  (`decidePendingSubagentRun`) is: the reconcile and the sweep end the others.

  It follows whatever freed a slot, a subagent run's end or a dead one finalized, rather than joining
  it, so it takes the member's lock after that write, as every run start does, never inside it. A
  launch that left its run pending promotes too, so a slot freed while it counted goes to the oldest
  run waiting: a promotion that ran meanwhile could not see that run yet.

  A promotion refused, the run promoted by another meanwhile, asked to stop, or every slot taken
  again, is read again, the run it named skipped from then on. A run whose queueing failed has its
  lease brought in to now, so the reconcile queues it again within its twenty minutes
*/
async function promoteSubagentRuns({
  organizationId,
  userId,
}: Pick<ConversationRunReference, 'organizationId' | 'userId'>) {
  const promoted: ConversationRunReference[] = []
  const refused = new Set<string>()

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const { data } = await getSubagentSlots(dataConnect, { organizationId, userId })
    const membershipCreatedAt = data.userOrganization?.createdAt ?? null
    const next = data.pendingRuns.find(
      run => !refused.has(run.id) && decidePendingSubagentRun(run, membershipCreatedAt) === 'promoted',
    )

    if (!membershipCreatedAt || !next || data.activeRuns.length >= MAX_ACTIVE_SUBAGENT_RUNS_PER_MEMBER) break

    const reference = { organizationId, userId, conversationId: next.conversation.id, runId: next.id }

    try {
      await promoteSubagentRun(dataConnect, { ...reference, membershipCreatedAt })
    } catch (error) {
      logger.warn(`Subagent run ${next.id}: its promotion was refused, and the slots are read again`, error)
      refused.add(next.id)

      continue
    }

    promoted.push(reference)

    await enqueueRun(reference, 'subagent-runs')
  }

  return promoted
}

export default promoteSubagentRuns
