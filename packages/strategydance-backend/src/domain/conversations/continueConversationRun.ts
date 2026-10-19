import { randomUUID } from 'node:crypto'

import { MAX_ACTIVE_RUNS_PER_MEMBER } from 'strategydance-core'
import {
  ConversationRunStatus,
  ConversationRunTrigger,
  continueConversationRun as continueConversationRunMutation,
  continueConversationRunWithCalls,
  getConversationTurnContext,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { IS_USAGE_CAPPED } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import { STOPPED_CALL_RESULT, toFailedOutput } from '~domain/conversations/conversationToolResults'
import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'
import readConversationOpenCalls from '~domain/conversations/readConversationOpenCalls'
import readReachedUsageCap from '~domain/conversations/readReachedUsageCap'
import readSubagentReportBlocks from '~domain/subagents/readSubagentReportBlocks'

// How many times a continuation reads where the conversation stands and tries, before it gives up
const MAX_ROUNDS = 4

export type ContinueConversationRunResult =
  // The run that carries the conversation on, started now or by an earlier try
  | { outcome: 'continued'; runId: string }
  // A question of the turn still waits, the caller has 3 runs in flight, started one and a half
  // times a daily cap on runs, or reached a daily spend ceiling: nothing starts yet
  | { outcome: 'waiting' }
  // The run waits for nothing: a send consumed its turn, or it is not the one that waits
  | { outcome: 'consumed' }
  // The conversation is not the caller's, or deleted, or the caller no member
  | { outcome: 'missing' }
  // The run is started, but could not be queued: it stays queued, and the next try queues it
  | { outcome: 'unavailable'; runId: string }

/*
  Carries a conversation on once every question of the turn its run waits on is answered: the
  answers go into the transcript, with the results of the calls that ran beside them, and a run
  answers them. Reached from the answer route, the same answer sent again and the reconcile route,
  so a backend that stopped between the last answer and this leaves nothing behind. Each round reads
  where things stand first:

  - the run waited, and a continuation started after it already: answered with that run, queued
    again while it waits, or consumed when a send took the turn instead
  - a question still waits: nothing starts
  - a run of the caller's in flight past its lease died with its worker, and is finalized before
    they are counted, and with 3 in flight nothing starts: the page's reconcile tries again
  - it finishes work under way, so it passes the daily caps on the runs the caller starts, up to one
    and a half times each, and past that nothing starts either: the answers are kept, and the page's
    reconcile starts it once the window has room
  - then the entry answering the turn is built and checked, and the run started, carrying after
    every result, the answers' included, the reports of the conversation's subagents waiting, which
    it marks delivered, as a send carries them. When the member allowed a call of the turn, which has
    not run, nothing can answer the turn yet: the run starts with no entry, carrying the turn on as a
    resumed run does, makes the calls allowed, then stores the entry itself, with the reports waiting
    then, and the calls a stop kept from running are answered as stopped

  A write refused anyway, because an answer, a send or a run got there in between, starts another
  round
*/
async function continueConversationRun(reference: ConversationRunReference): Promise<ContinueConversationRunResult> {
  const { organizationId, userId, conversationId, runId } = reference

  for (let round = 1; ; round++) {
    const { data } = await getConversationTurnContext(dataConnect, { organizationId, userId, conversationId })
    const { userOrganization: membership, conversation } = data
    const [latest, previous] = data.latestRuns

    if (
      !membership
      || !conversation
      || conversation.userId !== userId
      || conversation.organizationId !== organizationId
      || conversation.deletedAt
      // A subagent is its parent's, never acted on by its member
      || conversation.parentId
    ) {
      return { outcome: 'missing' }
    }

    if (latest && previous?.id === runId) {
      if (latest.trigger !== ConversationRunTrigger.ANSWER) return { outcome: 'consumed' }

      const started = { ...reference, runId: latest.id }
      const state = isDeadConversationRun(latest)
        ? await finalizeDeadConversationRun(started, 'conversation-runs')
        : 'alive'

      if (
        state === 'alive'
        && latest.status === ConversationRunStatus.QUEUED
        && !(await enqueueRun(started, 'conversation-runs'))
      ) {
        return { outcome: 'unavailable', runId: latest.id }
      }

      return { outcome: 'continued', runId: latest.id }
    }

    if (latest?.id !== runId || latest.status !== ConversationRunStatus.WAITING) return { outcome: 'consumed' }
    if (data.waitingQuestions.length) return { outcome: 'waiting' }

    // Read again once one has ended, which freed the caller's allowance
    if (
      (await finalizeDeadConversationRuns(reference, data.conversationRuns, 'conversation-runs'))
      && round < MAX_ROUNDS
    )
      continue

    if (data.conversationRuns.length >= MAX_ACTIVE_RUNS_PER_MEMBER) return { outcome: 'waiting' }
    // Counted again by the mutation, whose refusal comes back here
    if (await readReachedUsageCap(reference, ['runs', 'spend'], { isFinishing: true })) return { outcome: 'waiting' }

    const [lastEntry] = data.conversationTranscriptEntries
    // After every result, as a send carries them; a run carrying allowed calls on stores its own
    const reports = data.waitingReports.length
      ? await readSubagentReportBlocks(
          { organizationId, userId, membershipCreatedAt: membership.createdAt },
          data.waitingReports,
        )
      : []
    const answering = await readConversationOpenCalls(reference, lastEntry, {
      membershipCreatedAt: membership.createdAt,
      skipsQuestions: false,
      follows: reports,
    })

    if (!answering || !lastEntry) throw new Error(`Conversation ${conversationId} waits on a turn that called nothing`)

    const continuingRunId = randomUUID().replaceAll('-', '')
    const started = {
      organizationId,
      userId,
      conversationId,
      membershipCreatedAt: membership.createdAt,
      waitingRunId: runId,
      runId: continuingRunId,
      runNumber: conversation.nextRunNumber,
      isUsageCapped: IS_USAGE_CAPPED,
    }

    try {
      if (answering.allowedCallIds.length) {
        await continueConversationRunWithCalls(dataConnect, {
          ...started,
          anchorPosition: latest.anchorPosition,
          pendingToolResults: answering.latestRun?.pendingToolResults ?? null,
          stoppedCallIds: answering.stoppedCallIds,
          stoppedCallOutput: toFailedOutput(STOPPED_CALL_RESULT),
        })
      } else {
        await continueConversationRunMutation(dataConnect, {
          ...started,
          content: answering.content,
          transcriptPosition: lastEntry.position + 1,
          deliveredSubagentIds: data.waitingReports.map(({ id }) => toCanonicalUuid(id)),
        })
      }
    } catch (error) {
      if (round === MAX_ROUNDS) throw error

      continue
    }

    const queued = { ...reference, runId: continuingRunId }

    if (!(await enqueueRun(queued, 'conversation-runs'))) return { outcome: 'unavailable', runId: continuingRunId }

    return { outcome: 'continued', runId: continuingRunId }
  }
}

export default continueConversationRun
