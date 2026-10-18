import { getDeadConversationRunSweep } from 'strategydance-database/backend'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'

// How many times the runs past their lease are read again, a hundred at a time
const MAX_ROUNDS = 10

/*
  The backstop of the worker's reconcile, every five minutes, and of the daily sweep, for the runs
  of members' conversations that no page reconciles, queued or running past their lease: a reaction
  to subagents' reports above all, whose reports were delivered as it started, so nothing of its
  parent's page polls for it. Each is asked of Cloud Tasks, as the
  run reconcile asks: queued again while its task is gone and it is under twenty minutes old, its
  lease pushed back while its task is there, and finalized as interrupted otherwise, with its note
  (`finalizeDeadConversationRun`).

  A hundred at a time, read again after each round, since each one handled leaves them: a run whose
  queue could not say is left, and the rounds end once one finds nothing new. A run that fails is
  logged and left for the next sweep. Answers how many it ended
*/
async function sweepDeadConversationRuns() {
  let ended = 0
  const seen = new Set<string>()

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let runs

    try {
      runs = (await getDeadConversationRunSweep(dataConnect)).data.conversationRuns
    } catch (error) {
      logger.error('The sweep could not read the runs past their lease', error)

      break
    }

    const fresh = runs.filter(run => !seen.has(run.id))

    if (!fresh.length) break

    for (const run of fresh) {
      seen.add(run.id)

      try {
        const state = await finalizeDeadConversationRun(
          {
            organizationId: run.conversation.organizationId,
            userId: run.conversation.userId,
            conversationId: run.conversation.id,
            runId: run.id,
          },
          'conversation-runs',
        )

        if (state === 'ended') ended++
      } catch (error) {
        logger.error(`Conversation run ${run.id}: the sweep could not reconcile it past its lease`, error)
      }
    }
  }

  return { ended }
}

export default sweepDeadConversationRuns
