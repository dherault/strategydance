import { randomUUID } from 'node:crypto'

import { MAX_ACTIVE_RUNS_PER_MEMBER } from 'strategydance-core'
import {
  ConversationRunStatus,
  ConversationRunTrigger,
  getConversationRunControlContext,
  resumeConversationRun as resumeConversationRunMutation,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import buildKeptConversationPreview from '~domain/conversations/buildKeptConversationPreview'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRun from '~domain/conversations/finalizeDeadConversationRun'
import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import isDeadConversationRun from '~domain/conversations/isDeadConversationRun'

// How many times a resume reads where the conversation stands and tries, before it gives up
const MAX_ROUNDS = 4

export type ResumeConversationRunResult =
  | { outcome: 'resumed'; runId: string }
  // The caller is no member of the organization
  | { outcome: 'forbidden' }
  // The conversation is somebody else's, or deleted
  | { outcome: 'missing' }
  // A run goes in the conversation, or the caller has 3 in flight
  | { outcome: 'busy' }
  // The run is not the conversation's latest, did not stop or die, or something follows its note
  | { outcome: 'conflict' }
  // The run is started, but could not be queued: it stays queued, and the same resume sent again
  // queues it again, as its page's reconcile does meanwhile
  | { outcome: 'unavailable' }

/*
  Resumes a run its member stopped, or that died with its worker, from its note, which the page
  offers while the note is the thread's newest message: the note goes, and a run starts on the
  anchor of the run it resumes, carrying its response on. It sends its context and the request
  straight away when the response was cut before it was stored, and draws and continues what was
  stored otherwise. Each round reads where things stand first:

  - a resume sent again after its first try went through finds the run it started right after the
    one it resumes, and is answered with it, queued again while it waits
  - a run of the caller's in flight past its lease died with its worker, and is finalized first,
    the one to resume included, which then ends interrupted, with its note
  - then the run has to be the conversation's latest, stopped or interrupted, its note the newest
    message, the conversation idle and the caller's, and the caller to have fewer than 3 runs in
    flight

  A write refused anyway, because a send, a run or an aspects note got there in between, starts
  another round
*/
async function resumeConversationRun(reference: ConversationRunReference): Promise<ResumeConversationRunResult> {
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

    if (latest && previous?.id === runId && latest.trigger === ConversationRunTrigger.RESUME) {
      const started = { ...reference, runId: latest.id }
      const state = isDeadConversationRun(latest) ? await finalizeDeadConversationRun(started) : 'alive'

      if (state === 'alive' && latest.status === ConversationRunStatus.QUEUED && !(await enqueueRun(started))) {
        return { outcome: 'unavailable' }
      }

      return { outcome: 'resumed', runId: latest.id }
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

    const noteId = deriveConversationMessageId(runId, 'note')
    const [note, beforeNote] = data.latestMessages

    if (
      latest?.id !== runId
      || (latest.status !== ConversationRunStatus.STOPPED && latest.status !== ConversationRunStatus.INTERRUPTED)
      || note?.id !== noteId
      || data.newestMessages[0]?.id !== noteId
    ) {
      return { outcome: 'conflict' }
    }

    if (data.conversationRuns.length >= MAX_ACTIVE_RUNS_PER_MEMBER) return { outcome: 'busy' }

    const resumingRunId = randomUUID().replaceAll('-', '')

    try {
      await resumeConversationRunMutation(dataConnect, {
        organizationId,
        userId,
        conversationId,
        membershipCreatedAt: membership.createdAt,
        resumedRunId: runId,
        resumedRunNumber: latest.number,
        anchorPosition: latest.anchorPosition,
        noteId,
        notePosition: note.position,
        nextMessagePosition: conversation.nextMessagePosition,
        ...buildKeptConversationPreview(beforeNote),
        runId: resumingRunId,
        runNumber: conversation.nextRunNumber,
      })
    } catch (error) {
      if (round === MAX_ROUNDS) throw error

      continue
    }

    if (!(await enqueueRun({ ...reference, runId: resumingRunId }))) return { outcome: 'unavailable' }

    return { outcome: 'resumed', runId: resumingRunId }
  }
}

export default resumeConversationRun
