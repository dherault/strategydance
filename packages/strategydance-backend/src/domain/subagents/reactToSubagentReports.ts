import { randomUUID } from 'node:crypto'

import { MAX_ACTIVE_RUNS_PER_MEMBER } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  getSubagentReactionContext,
  markSubagentReportsDelivered,
  startSubagentReaction,
} from 'strategydance-database/backend'

import type { ConversationRunReference } from '~types'

import { IS_USAGE_CAPPED } from '~constants'

import { dataConnect } from '~firebase'

import toCanonicalUuid from '~utils/toCanonicalUuid'

import enqueueRun from '~domain/conversations/enqueueRun'
import finalizeDeadConversationRuns from '~domain/conversations/finalizeDeadConversationRuns'
import readReachedUsageCap from '~domain/conversations/readReachedUsageCap'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'
import findDueSubagentReports, { isWaitingReport } from '~domain/subagents/findDueSubagentReports'
import readSubagentReportBlocks from '~domain/subagents/readSubagentReportBlocks'

// How many times a reaction reads where its parent stands and tries, before it gives up
const MAX_ROUNDS = 4

export type SubagentReaction =
  // A reaction's run started, or was, on the reports due, queued on `conversation-runs`
  | { outcome: 'started'; runId: string }
  // The reaction's run is stored, but could not be queued: its lease is brought in, and its parent's
  // page or the worker's reconcile queues it again
  | { outcome: 'unavailable'; runId: string }
  // The member's 3 runs in flight are taken: the reports wait for the next of their runs to end, a
  // reconcile, the sweep, or the member's next message
  | { outcome: 'busy' }
  // The member started one and a half times a daily cap on runs, which a reaction passes a cap by
  // at most: the reports wait as they do for a run, until the window has room
  | { outcome: 'capped' }
  // The parent is full: its waiting reports were marked delivered, with no run
  | { outcome: 'delivered' }
  // Staff suspended the member's conversations, or the organization's: the reports wait until it is
  // lifted, since a worker would claim no run of theirs, and each refused would cost a run of the caps
  | { outcome: 'suspended' }
  // Nothing to react to yet: no report waits, a batch is still working, the parent is busy, waits on
  // an answer, or its latest run did not complete
  | { outcome: 'notDue' }
  // The conversation is not the caller's, deleted or a subagent, or the caller no member
  | { outcome: 'missing' }

/*
  Starts a parent's reaction to its subagents' reports, once one is due: every subagent of a batch
  has reported, a batch being those its runs launched on one anchor less those a retry deleted, and
  the parent is idle, its latest run completed, no question waiting. The reaction is a run of its
  own, triggered `REPORTS`, the first run no member started, counted toward the member's 3 runs in
  flight as any of theirs, its entry one block per report it delivers, of every batch complete
  (`readSubagentReportBlocks`), which the mutation marks delivered as it starts the run. Each round
  reads where things stand first:

  - a member whose conversations staff suspended, their account's or the organization's, starts
    nothing, and the reports wait until it is lifted
  - a parent whose latest run ended with the full note can neither react nor be sent to, so its
    waiting reports are marked delivered with no run, which nothing else would deliver
  - a run of the member's in flight past its lease died with its worker, and is finalized before
    they are counted, and with 3 in flight nothing starts
  - it finishes work under way, so it passes the daily caps on the runs the member starts, up to one
    and a half times each, and past that nothing starts either
  - a write refused anyway, because a send, an answer, another subagent's end or a report delivered
    got there in between, starts another round, which finds the parent busy or the reports delivered
  - a write that went through though its answer was lost starts another round too, which finds the
    parent held by the run that round started, and queues it

  Reached from a subagent's end, a parent's run ending, any run of the member's ending, the subagents'
  reconcile route and the daily sweep
*/
async function reactToSubagentReports(parent: Omit<ConversationRunReference, 'runId'>): Promise<SubagentReaction> {
  const { organizationId, userId } = parent
  const conversationId = toCanonicalUuid(parent.conversationId)
  const member = { organizationId, userId }
  // The run a round started, which a write whose answer was lost may have stored: only this call
  // knows to queue it, since the reports it carries were marked delivered with it
  let startedRunId: string | null = null

  for (let round = 1; ; round++) {
    const { data } = await getSubagentReactionContext(dataConnect, { organizationId, userId, conversationId })
    const { userOrganization: membership, conversation } = data

    if (
      !membership
      || !conversation
      || conversation.userId !== userId
      || toCanonicalUuid(conversation.organizationId) !== toCanonicalUuid(organizationId)
      || conversation.deletedAt
      || conversation.parentId
    ) {
      return { outcome: 'missing' }
    }

    if (startedRunId && conversation.activeRunId && toCanonicalUuid(conversation.activeRunId) === startedRunId) {
      return queueReaction({ ...parent, conversationId, runId: startedRunId })
    }

    if (data.user?.conversationsSuspendedAt || data.organization?.conversationsSuspendedAt) {
      return { outcome: 'suspended' }
    }

    const waiting = data.subagents.filter(isWaitingReport)

    if (!waiting.length) return { outcome: 'notDue' }

    const [latest] = data.latestRuns

    try {
      if (latest?.status === ConversationRunStatus.FAILED && latest.notes[0]?.noteKind === ConversationNoteKind.FULL) {
        await markSubagentReportsDelivered(dataConnect, {
          organizationId,
          userId,
          conversationId,
          parentRunNumber: latest.number,
          subagentIds: waiting.map(({ id }) => toCanonicalUuid(id)),
        })

        return { outcome: 'delivered' }
      }

      if (
        conversation.activeRunId
        || conversation.isAwaitingAnswer
        || latest?.status !== ConversationRunStatus.COMPLETED
      ) {
        return { outcome: 'notDue' }
      }

      const due = findDueSubagentReports(data.subagents)

      if (!due.length) return { outcome: 'notDue' }

      // Read again once one has ended, which freed one of the member's runs
      if (
        (await finalizeDeadConversationRuns(member, data.conversationRuns, 'conversation-runs'))
        && round < MAX_ROUNDS
      )
        continue

      if (data.conversationRuns.length >= MAX_ACTIVE_RUNS_PER_MEMBER) return { outcome: 'busy' }
      // Counted again by the mutation, whose refusal comes back here
      if (await readReachedUsageCap(member, ['runs'], { isFinishing: true })) return { outcome: 'capped' }

      const blocks = await readSubagentReportBlocks({ ...member, membershipCreatedAt: membership.createdAt }, due)
      const runId = randomUUID().replaceAll('-', '')

      startedRunId = runId

      await startSubagentReaction(dataConnect, {
        organizationId,
        userId,
        conversationId,
        membershipCreatedAt: membership.createdAt,
        runId,
        runNumber: conversation.nextRunNumber,
        content: serializeTranscriptContent(blocks),
        transcriptPosition: (data.lastEntries[0]?.position ?? -1) + 1,
        subagentIds: due.map(({ id }) => toCanonicalUuid(id)),
        isUsageCapped: IS_USAGE_CAPPED,
      })

      return await queueReaction({ ...parent, conversationId, runId })
    } catch (error) {
      if (round >= MAX_ROUNDS) throw error
    }
  }
}

// Queues a reaction's run, stored and holding its parent: started, or unavailable when its task
// could not be queued, its lease then brought in so a reconcile queues it again
async function queueReaction(reference: ConversationRunReference): Promise<SubagentReaction> {
  const { runId } = reference

  return (await enqueueRun(reference, 'conversation-runs'))
    ? { outcome: 'started', runId }
    : { outcome: 'unavailable', runId }
}

export default reactToSubagentReports
