import { randomUUID } from 'node:crypto'

import { MAX_ACTIVE_RUNS_PER_MEMBER } from 'strategydance-core'
import {
  ConversationRunStatus,
  ConversationRunTrigger,
  getConversationRetryContext,
  getConversationRunControlContext,
  retryConversationRun as retryConversationRunMutation,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import buildKeptConversationPreview from '~domain/conversations/buildKeptConversationPreview'
import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'

// How many times a retry reads where the conversation stands and tries, before it gives up
const MAX_ROUNDS = 4

// The statuses a run that ended with a note ends in, which Retry is offered for
const RETRIED_STATUSES = [
  ConversationRunStatus.STOPPED,
  ConversationRunStatus.FAILED,
  ConversationRunStatus.REFUSED,
  ConversationRunStatus.INTERRUPTED,
]

export type RetryConversationRunResult =
  | { outcome: 'retried'; runId: string; removedRunIds: string[] }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The conversation is somebody else's, or deleted
  | { outcome: 'missing' }
  // A run goes in the conversation, or the caller has 3 in flight
  | { outcome: 'busy' }
  // The run is not the conversation's latest, or did not end with a note
  | { outcome: 'conflict' }
  // The run is started, but could not be queued: it stays queued, and the same retry sent again
  // queues it again, as its page's reconcile does meanwhile
  | { outcome: 'unavailable' }

/*
  Retries a run that ended with a note, stopped, failed, refused, full or interrupted: the transcript
  goes back to the run's anchor, the member's entry it answers, every message the runs on that
  anchor drew goes, the retried run's and those of the runs it resumed, but the member's, and a run
  answers the anchor again, with a context message of its own. It is never refused for a full
  conversation, since it gives back the room the runs took, and marks the conversation full no
  longer: the run measures again before its request. Answers with the runs whose messages went, which
  the page drops from every page it holds. Each round reads where things stand first:

  - a retry sent again after its first try went through finds the run it started right after the
    one it retries, and is answered with it, queued again while it waits
  - a run of the caller's in flight past its lease died with its worker, and is finalized first,
    the one to retry included, which then ends interrupted, with its note
  - then the run has to be the conversation's latest and have ended with a note, the conversation
    idle and the caller's, and the caller to have fewer than 3 runs in flight

  A write refused anyway, because a send, a run or an aspects note got there in between, starts
  another round
*/
async function retryConversationRun(reference: ConversationRunReference): Promise<RetryConversationRunResult> {
  const { organizationId, userId, conversationId, runId } = reference

  for (let round = 1; ; round++) {
    const { data } = await getConversationRunControlContext(dataConnect, { organizationId, userId, conversationId })
    const { userOrganization: membership, conversation } = data
    const [latest, previous] = data.latestRuns

    if (!membership) return { outcome: 'forbidden' }

    if (
      !conversation
      || conversation.userId !== userId
      || conversation.organizationId !== organizationId
      || conversation.deletedAt
    ) {
      return { outcome: 'missing' }
    }

    if (latest && previous?.id === runId && latest.trigger === ConversationRunTrigger.RETRY) {
      const started = { ...reference, runId: latest.id }
      const state = isDeadConversationRun(latest) ? await finalizeDeadConversationRun(started) : 'alive'

      if (state === 'alive' && latest.status === ConversationRunStatus.QUEUED && !(await enqueueRun(started))) {
        return { outcome: 'unavailable' }
      }

      const { data: retryContext } = await getConversationRetryContext(dataConnect, {
        organizationId,
        userId,
        conversationId,
        anchorPosition: latest.anchorPosition,
      })

      return {
        outcome: 'retried',
        runId: latest.id,
        removedRunIds: retryContext.anchorRuns.map(({ id }) => id).filter(id => id !== latest.id),
      }
    }

    // Read again once one has ended, which freed its conversation and the caller's allowance
    if ((await finalizeDeadConversationRuns(reference, data.conversationRuns)) && round < MAX_ROUNDS) continue

    if (conversation.activeRunId) {
      const activeRun = data.conversationRuns.find(run => run.id === conversation.activeRunId)

      if (activeRun?.status === ConversationRunStatus.QUEUED) {
        await enqueueRun({ ...reference, runId: activeRun.id })
      }

      return { outcome: 'busy' }
    }

    if (latest?.id !== runId || !RETRIED_STATUSES.includes(latest.status)) return { outcome: 'conflict' }

    if (data.conversationRuns.length >= MAX_ACTIVE_RUNS_PER_MEMBER) return { outcome: 'busy' }

    const { data: retryContext } = await getConversationRetryContext(dataConnect, {
      organizationId,
      userId,
      conversationId,
      anchorPosition: latest.anchorPosition,
    })
    const retryingRunId = randomUUID().replaceAll('-', '')

    try {
      await retryConversationRunMutation(dataConnect, {
        organizationId,
        userId,
        conversationId,
        membershipCreatedAt: membership.createdAt,
        retriedRunId: runId,
        retriedRunNumber: latest.number,
        anchorPosition: latest.anchorPosition,
        historyRevision: conversation.historyRevision,
        deletedCount: retryContext.drawnMessages[0]?._count ?? 0,
        ...buildKeptConversationPreview(retryContext.keptMessages[0]),
        runId: retryingRunId,
        runNumber: conversation.nextRunNumber,
      })
    } catch (error) {
      if (round === MAX_ROUNDS) throw error

      continue
    }

    if (!(await enqueueRun({ ...reference, runId: retryingRunId }))) return { outcome: 'unavailable' }

    return {
      outcome: 'retried',
      runId: retryingRunId,
      removedRunIds: retryContext.anchorRuns.map(({ id }) => id),
    }
  }
}

export default retryConversationRun
