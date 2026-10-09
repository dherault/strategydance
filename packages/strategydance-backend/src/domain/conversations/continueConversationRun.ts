import { randomUUID } from 'node:crypto'

import { MAX_ACTIVE_RUNS_PER_MEMBER } from 'strategydance-core'
import {
  ConversationRunStatus,
  ConversationRunTrigger,
  continueConversationRun as continueConversationRunMutation,
  getConversationTurnContext,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'
import readConversationOpenCalls from '~domain/conversations/readConversationOpenCalls'

// How many times a continuation reads where the conversation stands and tries, before it gives up
const MAX_ROUNDS = 4

export type ContinueConversationRunResult =
  // The run that carries the conversation on, started now or by an earlier try
  | { outcome: 'continued'; runId: string }
  // A question of the turn still waits, or the caller has 3 runs in flight: nothing starts yet
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
  - then the entry answering the turn is built and checked, and the run started

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
    ) {
      return { outcome: 'missing' }
    }

    if (latest && previous?.id === runId) {
      if (latest.trigger !== ConversationRunTrigger.ANSWER) return { outcome: 'consumed' }

      const started = { ...reference, runId: latest.id }
      const state = isDeadConversationRun(latest) ? await finalizeDeadConversationRun(started) : 'alive'

      if (state === 'alive' && latest.status === ConversationRunStatus.QUEUED && !(await enqueueRun(started))) {
        return { outcome: 'unavailable', runId: latest.id }
      }

      return { outcome: 'continued', runId: latest.id }
    }

    if (latest?.id !== runId || latest.status !== ConversationRunStatus.WAITING) return { outcome: 'consumed' }
    if (data.waitingQuestions.length) return { outcome: 'waiting' }

    // Read again once one has ended, which freed the caller's allowance
    if ((await finalizeDeadConversationRuns(reference, data.conversationRuns)) && round < MAX_ROUNDS) continue

    if (data.conversationRuns.length >= MAX_ACTIVE_RUNS_PER_MEMBER) return { outcome: 'waiting' }

    const [lastEntry] = data.conversationTranscriptEntries
    const answering = await readConversationOpenCalls(reference, lastEntry, { skipsQuestions: false })

    if (!answering || !lastEntry) throw new Error(`Conversation ${conversationId} waits on a turn that called nothing`)

    const continuingRunId = randomUUID().replaceAll('-', '')

    try {
      await continueConversationRunMutation(dataConnect, {
        organizationId,
        userId,
        conversationId,
        membershipCreatedAt: membership.createdAt,
        waitingRunId: runId,
        runId: continuingRunId,
        runNumber: conversation.nextRunNumber,
        content: answering.content,
        transcriptPosition: lastEntry.position + 1,
      })
    } catch (error) {
      if (round === MAX_ROUNDS) throw error

      continue
    }

    const started = { ...reference, runId: continuingRunId }

    if (!(await enqueueRun(started))) return { outcome: 'unavailable', runId: continuingRunId }

    return { outcome: 'continued', runId: continuingRunId }
  }
}

export default continueConversationRun
