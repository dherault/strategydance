import { setTimeout as wait } from 'node:timers/promises'

import { buildConversationPreview } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  ConversationTranscriptRole,
  getConversationCalls,
  getConversationRunContext,
  interruptDeadConversationRun,
  renewQueuedConversationRunLease,
} from 'strategydance-database/backend'

import type { ConversationRunQueue, ConversationRunReference } from '~types'

import { ARE_CONVERSATION_RUNS_IN_PROCESS, CONVERSATION_RUN_REQUEUE_WINDOW_MS } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import readConversationToolCalls from '~domain/agent/readConversationToolCalls'
import { parsePendingToolResults } from '~domain/conversations/conversationToolResults'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import findConversationRunTask from '~domain/conversations/findConversationRunTask'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import queueConversationRun from '~domain/conversations/queueConversationRun'
import settleConversationModuleWrites from '~domain/conversations/settleConversationModuleWrites'

// How many times a run is read and finalized before the caller is told it could not be
const MAX_TRIES = 4

type Options = {
  // How long it waits after a refusal, times the refusals so far
  retryDelayMs?: number
}

/*
  Finalizes a run that died with its worker, as a route finds it before it starts another: queued or
  claimed, past its lease. It ends interrupted, with its note at the counter of its own
  conversation, which may not be the one the route is about, so that conversation's page is the one
  that refreshes. Answers `ended` once it has, by this or before it, `alive` for a run whose lease
  holds or that is still coming, and `missing` for none in that conversation, the caller's, in that
  organization.

  A queued run's lease only says when to ask again whether it is still coming, so where runs go
  through the queue, Cloud Tasks is asked first, on the run's own queue, and a queued run past its lease is kept while its
  task is there. Its task gone, the run is queued again while it is young (see
  `CONVERSATION_RUN_REQUEUE_WINDOW_MS`), and finalized once it is older. A claimed run past its
  lease is dead whatever the queue holds, and so is a queued one in development, which has no queue.
  A subagent's run is answered `missing`, since its endings write its report, which this does not.

  Once the run has ended, a call to a module's write it left started is answered by what the module
  stored under its key, when it stored anything (`settleConversationModuleWrites`): the write
  landed, and the thread says so. One that fails to is left for the next send, which reads the key
  again.

  A refusal is read again, since something can move the counter or end the run meanwhile: a worker
  that renewed its lease keeps it, and a run something else ended is left as it is. Throws once the
  counter keeps moving
*/
async function finalizeDeadConversationRun(
  reference: ConversationRunReference,
  queue: ConversationRunQueue,
  { retryDelayMs = 200 }: Options = {},
): Promise<'missing' | 'ended' | 'alive'> {
  for (let tries = 1; ; tries++) {
    const { data } = await getConversationRunContext(dataConnect, reference)
    const [run] = data.conversationRuns

    // A subagent's run ends through its own endings, which write its report, and never here
    if (!run || data.conversation?.parentId) return 'missing'

    if (run.status !== ConversationRunStatus.QUEUED && run.status !== ConversationRunStatus.RUNNING) return 'ended'

    if (!run.leaseExpiresAt || Date.parse(run.leaseExpiresAt) >= Date.now()) return 'alive'

    if (
      run.status === ConversationRunStatus.QUEUED
      && !ARE_CONVERSATION_RUNS_IN_PROCESS
      && (await isStillComing(reference, queue, run.createdAt))
    ) {
      return 'alive'
    }

    try {
      await interruptDeadConversationRun(dataConnect, {
        ...reference,
        noteId: deriveConversationMessageId(reference.runId, 'note'),
        position: data.conversation?.nextMessagePosition ?? 0,
        preview: buildConversationPreview({ kind: 'NOTE', noteKind: ConversationNoteKind.INTERRUPTED }),
        failure: describeDeath(run.status),
      })
    } catch (error) {
      if (tries === MAX_TRIES) throw error

      await wait(tries * retryDelayMs)

      continue
    }

    try {
      await settleStartedWrites(reference, run.membershipCreatedAt, data.conversationTranscriptEntries[0])
    } catch (error) {
      logger.warn(`Conversation run ${reference.runId}: its started writes could not be settled`, error)
    }

    return 'ended'
  }
}

// The module writes the turn the transcript ends on left started, answered from their keys
async function settleStartedWrites(
  { organizationId, userId, conversationId }: ConversationRunReference,
  membershipCreatedAt: string,
  lastEntry: { role: ConversationTranscriptRole; content: string } | undefined,
) {
  if (lastEntry?.role !== ConversationTranscriptRole.ASSISTANT) return

  const calls = readConversationToolCalls(parseTranscriptContent(lastEntry.content))

  if (!calls.length) return

  const { data } = await getConversationCalls(dataConnect, {
    organizationId,
    userId,
    conversationId,
    toolUseIds: calls.map(({ id }) => id),
  })

  await settleConversationModuleWrites({
    reference: { organizationId, userId, conversationId },
    membershipCreatedAt,
    messages: data.conversationMessages,
    pending: parsePendingToolResults(data.latestRuns[0]?.pendingToolResults),
  })
}

// Why a run past its lease died, for the logs
function describeDeath(status: ConversationRunStatus) {
  if (status === ConversationRunStatus.RUNNING) return 'Its worker stopped renewing its lease'

  return ARE_CONVERSATION_RUNS_IN_PROCESS
    ? 'No worker claimed it before its lease passed'
    : 'Its task was gone from the queue, and the run too old to queue again'
}

/*
  Whether a queued run past its lease is still coming, as Cloud Tasks says, pushing its lease back
  twenty minutes when it is:

  - its task is there, waiting or being delivered
  - Cloud Tasks could not say, which changes nothing, and the page asks again in two minutes
  - its task is gone, but the run is young enough to be queued again, as it is now. When that fails
    too, its lease is left due, so the page asks again in two minutes

  Otherwise it is dead: its task is gone, and the run older
*/
async function isStillComing(
  { organizationId, userId, conversationId, runId }: ConversationRunReference,
  queue: ConversationRunQueue,
  createdAt: string,
) {
  const reference = { organizationId, userId, conversationId, runId }
  const task = await findConversationRunTask(runId, queue)

  if (task === 'unknown') return true

  if (task === 'gone') {
    if (Date.parse(createdAt) + CONVERSATION_RUN_REQUEUE_WINDOW_MS <= Date.now()) return false

    if ((await queueConversationRun(reference, queue)) === 'unavailable') return true
  }

  await renewQueuedConversationRunLease(dataConnect, reference)

  return true
}

export default finalizeDeadConversationRun
