import { setTimeout as wait } from 'node:timers/promises'

import {
  ConversationRunStatus,
  getSubagentForAgent,
  requestSubagentRunStopForAgent,
} from 'strategydance-database/backend'

import type { ModuleCall, ModuleCaller, SubagentStatus, SubagentsWriteResult } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import answerFromModuleCall from '~domain/modules/answerFromModuleCall'
import isOperationRefusal from '~domain/modules/isOperationRefusal'
import { NOT_MEMBER_REFUSAL } from '~domain/modules/moduleRefusalMessages'
import toModuleCallVariables from '~domain/modules/toModuleCallVariables'
import endPendingSubagentRun from '~domain/subagents/endPendingSubagentRun'
import promoteSubagentRuns from '~domain/subagents/promoteSubagentRuns'
import readSubagentLauncher from '~domain/subagents/readSubagentLauncher'
import stopQueuedSubagentRun from '~domain/subagents/stopQueuedSubagentRun'
import toSubagentStatus from '~domain/subagents/toSubagentStatus'

// How many times a stop reads the run its subagent is busy with and asks it to stop, before it
// gives up: a chain swaps the run between the read and the write
const MAX_TRIES = 4

// What stopping answers: the subagent, and whether it had ended already, with how, in which case
// nothing changed
export type StoppedSubagent = { id: string; isEnded: false } | { id: string; isEnded: true; status: SubagentStatus }

type Options = {
  // How long it waits after a refusal, times the refusals so far
  retryDelayMs?: number
}

/*
  Asks one subagent of the calling conversation to stop, as its row's Stop will: the run it is busy
  with, read by its `activeRunId` and asked to stop, and read again after any refusal, since a chain
  swaps the run between the read and the write, and the old run, `CHAINED`, is no longer the one to
  stop. A queued run, or one waiting for a slot, then ends at once, with its report; a working one
  ends at its worker's next step, reporting what it had. A queued run held one of the member's five
  slots, which the oldest run waiting is promoted into.

  A subagent that has ended is answered so, and one asked to stop already as asked, neither writing
  anything. Called again with its key, the stop is answered as it was, and what it left unfinished,
  a run asked to stop still waiting, is ended then
*/
async function stopSubagent(
  caller: ModuleCaller,
  { id }: { id: string },
  call: ModuleCall | null,
  { retryDelayMs = 200 }: Options = {},
): Promise<SubagentsWriteResult<StoppedSubagent>> {
  const subagentId = toCanonicalUuid(id)
  const answered = await answerFromModuleCall(caller, call)

  if (answered?.outcome === 'answered') await endStoppedRun(caller, subagentId)
  if (answered) return answered

  for (let tries = 1; ; tries++) {
    const launcher = await readSubagentLauncher(caller)

    if (launcher.outcome !== 'running') return launcher

    const { data } = await getSubagentForAgent(dataConnect, {
      organizationId: caller.organizationId,
      userId: caller.userId,
      membershipCreatedAt: caller.membershipCreatedAt,
      parentId: launcher.conversationId,
      id: subagentId,
    })

    if (data.membership.length === 0) return { outcome: 'notMember' }

    const [subagent] = data.subagents
    const [run] = subagent?.latestRuns ?? []

    if (!subagent || !run) return { outcome: 'notFound' }

    const result: StoppedSubagent = { id: subagentId, isEnded: false }

    if (!subagent.activeRunId || toCanonicalUuid(subagent.activeRunId) !== toCanonicalUuid(run.id)) {
      // Busy with no run, it has ended, its report written. A latest run that is not the one it is
      // busy with is one its chain is swapping, read again
      if (!subagent.activeRunId) {
        return { outcome: 'unchanged', result: { id: subagentId, isEnded: true, status: toSubagentStatus(run.status) } }
      }
    } else if (run.stopRequestedAt) {
      await endStoppedRun(caller, subagentId)

      return { outcome: 'unchanged', result }
    } else {
      try {
        await requestSubagentRunStopForAgent(dataConnect, {
          organizationId: caller.organizationId,
          userId: caller.userId,
          membershipCreatedAt: caller.membershipCreatedAt,
          parentId: launcher.conversationId,
          launchRunId: launcher.runId,
          conversationId: subagentId,
          runId: toCanonicalUuid(run.id),
          ...toModuleCallVariables(caller, call, result),
        })

        await endStoppedRun(caller, subagentId)

        return { outcome: 'written', result }
      } catch (error) {
        // A key taken by the same call meanwhile, or by this one, whose answer was lost after it
        // landed, which reading the run again would take for a stop asked before
        const answeredMeanwhile = await answerFromModuleCall(caller, call)

        if (answeredMeanwhile?.outcome === 'answered') await endStoppedRun(caller, subagentId)
        if (answeredMeanwhile) return answeredMeanwhile
        if (isOperationRefusal(error, NOT_MEMBER_REFUSAL)) return { outcome: 'notMember' }

        // The run ended, chained, or its launcher stopped meanwhile: read again, which says which
        if (tries === MAX_TRIES) throw error
      }
    }

    if (tries === MAX_TRIES) return { outcome: 'busy' }

    await wait(tries * retryDelayMs)
  }
}

/*
  Ends the run a subagent is busy with once it was asked to stop, when no worker will: a queued one
  at once, then a promotion into the slot it held, and one waiting for a slot, which held none. A
  working one is its worker's to end. One that fails is logged and left to the reconcile and the
  sweep, which end a run waiting asked to stop, and to the worker, which stops a queued one at its
  claim: the stop stands either way
*/
async function endStoppedRun(caller: ModuleCaller, subagentId: string) {
  const member = { organizationId: caller.organizationId, userId: caller.userId }

  try {
    const launcher = await readSubagentLauncher(caller)

    if (launcher.outcome !== 'running') return

    const { data } = await getSubagentForAgent(dataConnect, {
      ...member,
      membershipCreatedAt: caller.membershipCreatedAt,
      parentId: launcher.conversationId,
      id: subagentId,
    })
    const [subagent] = data.subagents
    const [run] = subagent?.latestRuns ?? []

    if (!subagent?.activeRunId || !run?.stopRequestedAt) return
    if (toCanonicalUuid(subagent.activeRunId) !== toCanonicalUuid(run.id)) return

    const reference = { ...member, conversationId: subagentId, runId: toCanonicalUuid(run.id) }

    if (run.status === ConversationRunStatus.QUEUED && (await stopQueuedSubagentRun(reference))) {
      await promoteSubagentRuns(member)
    }

    if (run.status === ConversationRunStatus.PENDING) await endPendingSubagentRun(reference, 'stopped')
  } catch (error) {
    logger.warn(`Subagent ${subagentId}: its run asked to stop could not be ended at once`, error)
  }
}

export default stopSubagent
