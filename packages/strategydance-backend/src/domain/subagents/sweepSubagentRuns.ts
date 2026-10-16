import { getSubagentRunsToSweep } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import reconcileSubagentRuns from '~domain/subagents/reconcileSubagentRuns'

/*
  The daily sweep's backstop for subagents, which no page may reconcile: every member with a
  subagent run past its lease, or one waiting for a slot, in any organization, has their subagent
  runs there reconciled as a parent's page would (`reconcileSubagentRuns`), so a crash, a run whose
  task never came or a member removed never leaves a subagent busy for good.

  A member whose reconcile fails is logged and left for the next sweep, and so is the whole step when
  its read fails, so the prunes after it still run. Answers how many members it reconciled
*/
async function sweepSubagentRuns() {
  const read = await getSubagentRunsToSweep(dataConnect).catch((error: unknown) => {
    logger.error('The sweep could not read the subagent runs to reconcile', error)

    return null
  })

  if (!read) return { reconciled: 0 }

  const runs = read.data
  const members = new Map<string, { organizationId: string; userId: string }>()

  for (const { conversation } of [...runs.deadRuns, ...runs.pendingRuns]) {
    members.set(`${conversation.userId}:${conversation.organizationId}`, {
      organizationId: conversation.organizationId,
      userId: conversation.userId,
    })
  }

  let reconciled = 0

  for (const member of members.values()) {
    try {
      await reconcileSubagentRuns(member)

      reconciled++
    } catch (error) {
      logger.error(`The sweep could not reconcile the subagent runs of ${member.userId}`, error)
    }
  }

  return { reconciled }
}

export default sweepSubagentRuns
