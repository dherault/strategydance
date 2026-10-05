import { randomUUID } from 'node:crypto'
import { setTimeout as wait } from 'node:timers/promises'

import {
  ARE_CONVERSATIONS_STAFF_ONLY,
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATION_RUN_ENTRIES,
} from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  ConversationTranscriptRole,
  type GetConversationRunContextData,
  claimQueuedConversationRun,
  getConversationRunContext,
  reclaimConversationRun,
  storeConversationTurn,
} from 'strategydance-database/backend'

import type { ConversationAgent, ConversationRunFence, ConversationRunReference } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import conversationAgent from '~domain/agent/conversationAgent'
import createConversationRunLease, { type ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import drawConversationTurn from '~domain/conversations/drawConversationTurn'
import endConversationRun, { type ConversationRunEnding } from '~domain/conversations/endConversationRun'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'

// How many steps a run takes at most, each a turn, a message drawn or its end. A run draws at most
// 100 entries before it sends no further request, so only a loop that would never end reaches it
const MAX_RUN_STEPS = 4 * MAX_CONVERSATION_RUN_ENTRIES

// How many steps in a row may fail before the worker leaves the run to its lease
const MAX_FAILED_STEPS = 5

type Options = {
  agent?: ConversationAgent
  // How long the worker waits after a failed step, times the failures in a row
  retryDelayMs?: number
}

type ConversationRunContext = GetConversationRunContextData

/*
  Runs a conversation's run, answers `finished` once it has ended, now or before, and `held` while
  it is not finished and a later delivery should come back to it: another worker holds its lease,
  or this one gave up on it, whose lease then lapses.

  It first claims the run, if it is queued or its worker stopped renewing its lease, and only for
  its author as the member it was queued under, and still staff while conversations are: anybody
  else's run ends interrupted, with its note, so nothing is left for a later delivery. Then it takes
  one step at a time, each read afresh, so a worker taking over after a crash carries on where the
  last one stopped:

  - a stored turn not wholly drawn yet: the next message of it
  - a turn wholly drawn: the run is complete, since no tool runs yet
  - the member's message: the agent's turn, stored as it answered, unless the run has drawn its 100
    entries, or the conversation holds its 2000, when the run fails with a note instead and costs
    nothing

  Every write is fenced on the run's attempt and its author's membership, and the step after a
  refused one reads which it was: a run claimed again or ended by somebody else is left alone, a
  removed author's is interrupted, a deleted conversation's stops, and anything else, a counter an
  aspects note moved say, is tried again
*/
async function runConversation(
  reference: ConversationRunReference,
  { agent = conversationAgent, retryDelayMs = 500 }: Options = {},
): Promise<'finished' | 'held'> {
  const context = await readContext(reference)
  const [run] = context.conversationRuns

  if (!run || !isInFlight(run.status)) return 'finished'
  if (run.status === ConversationRunStatus.RUNNING && !isPast(run.leaseExpiresAt)) return 'held'

  if (!isAuthorStill(context, run.membershipCreatedAt)) {
    return interruptBeforeClaiming(reference, run.attempts, context, retryDelayMs)
  }

  const claim = run.status === ConversationRunStatus.QUEUED ? claimQueuedConversationRun : reclaimConversationRun
  const { data } = await claim(dataConnect, {
    ...reference,
    attempts: run.attempts,
    membershipCreatedAt: run.membershipCreatedAt,
  })

  if (data.conversationRun_updateMany !== 1) return 'held'

  const fence: ConversationRunFence = {
    ...reference,
    attempts: run.attempts + 1,
    membershipCreatedAt: run.membershipCreatedAt,
  }
  const controller = new AbortController()
  const lease = createConversationRunLease({ fence, onLost: () => controller.abort() })

  try {
    return await takeSteps({ fence, lease, signal: controller.signal, agent, retryDelayMs })
  } finally {
    await lease.stop()
  }
}

type StepsInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  signal: AbortSignal
  agent: ConversationAgent
  retryDelayMs: number
}

async function takeSteps({ fence, lease, signal, agent, retryDelayMs }: StepsInput) {
  const reference = toReference(fence)
  let failedSteps = 0

  for (let step = 0; step < MAX_RUN_STEPS; step++) {
    const context = await readContext(reference)
    const [run] = context.conversationRuns

    if (run?.status !== ConversationRunStatus.RUNNING || run.attempts !== fence.attempts) return 'finished'

    try {
      const isEnded = await takeStep({ context, fence, lease, signal, agent })

      if (isEnded) return 'finished'

      failedSteps = 0
    } catch (error) {
      failedSteps++

      if (failedSteps === MAX_FAILED_STEPS) {
        logger.error(`Conversation run ${fence.runId}: ${failedSteps} steps failed in a row, left to its lease`, error)

        return 'held'
      }

      logger.warn(`Conversation run ${fence.runId}: a step failed, and is read again`, error)

      await wait(failedSteps * retryDelayMs)
    }
  }

  logger.error(`Conversation run ${fence.runId}: took ${MAX_RUN_STEPS} steps without ending, left to its lease`)

  return 'held'
}

type StepInput = Omit<StepsInput, 'retryDelayMs'> & {
  context: ConversationRunContext
}

// Takes the run's next step, and answers whether it ended the run
async function takeStep({ context, fence, lease, signal, agent }: StepInput) {
  const { conversation } = context
  const [entry] = context.conversationTranscriptEntries
  const position = conversation?.nextMessagePosition ?? 0

  async function end(ending: ConversationRunEnding) {
    await endConversationRun({ ending, fence, lease, position })

    return true
  }

  if (!isAuthorStill(context, fence.membershipCreatedAt)) {
    return end({ kind: 'interrupted', reference: toReference(fence), attempts: fence.attempts })
  }

  if (!conversation || conversation.deletedAt) return end({ kind: 'finished', status: ConversationRunStatus.STOPPED })

  if (!entry) throw new Error('A run answers a transcript, and its conversation has none')

  if (entry.role === ConversationTranscriptRole.ASSISTANT) {
    const blocks = parseTranscriptContent(entry.content)

    if (await drawConversationTurn({ fence, lease, entry, blocks, position })) return false

    return end({ kind: 'finished', status: ConversationRunStatus.COMPLETED })
  }

  if (context.conversationMessages.length >= MAX_CONVERSATION_RUN_ENTRIES) {
    return end({ kind: 'noted', status: ConversationRunStatus.FAILED, noteKind: ConversationNoteKind.FAILED })
  }

  if (conversation.messageCount >= MAX_CONVERSATION_MESSAGES) {
    return end({ kind: 'noted', status: ConversationRunStatus.FAILED, noteKind: ConversationNoteKind.FULL })
  }

  const turn = await agent.respond({
    lastEntry: parseTranscriptContent(entry.content),
    signal,
    onStep: step => lease.setStep(step),
  })

  await lease.write(() =>
    storeConversationTurn(dataConnect, {
      ...fence,
      entryId: randomUUID().replaceAll('-', ''),
      position: entry.position + 1,
      content: serializeTranscriptContent(turn.content),
    }),
  )

  return false
}

/*
  Ends a run whose author is no longer the member it was queued under before any worker claims it,
  at the attempt read. Read again and tried again when it is refused, since the note's counter may
  have moved: a run something else ended meanwhile is left as it is
*/
async function interruptBeforeClaiming(
  reference: ConversationRunReference,
  attempts: number,
  firstContext: ConversationRunContext,
  retryDelayMs: number,
) {
  let context = firstContext

  for (let failedTries = 1; ; failedTries++) {
    try {
      await endConversationRun({
        ending: { kind: 'interrupted', reference, attempts },
        fence: null,
        lease: null,
        position: context.conversation?.nextMessagePosition ?? 0,
      })

      return 'finished'
    } catch (error) {
      if (failedTries === MAX_FAILED_STEPS) {
        logger.error(`Conversation run ${reference.runId}: could not be interrupted, left to its lease`, error)

        return 'held'
      }

      await wait(failedTries * retryDelayMs)

      context = await readContext(reference)

      const [run] = context.conversationRuns

      if (!run || !isInFlight(run.status) || run.attempts !== attempts) return 'finished'
    }
  }
}

async function readContext(reference: ConversationRunReference) {
  const { data } = await getConversationRunContext(dataConnect, reference)

  return data
}

// The run's keys alone, which a read takes
function toReference({ organizationId, userId, conversationId, runId }: ConversationRunReference) {
  return { organizationId, userId, conversationId, runId }
}

function isInFlight(status: ConversationRunStatus) {
  return status === ConversationRunStatus.QUEUED || status === ConversationRunStatus.RUNNING
}

function isPast(time: string | null | undefined) {
  return Boolean(time) && Date.parse(time ?? '') < Date.now()
}

// Whether the run's author is still the member it was queued under, and still staff while
// conversations are open to staff alone
function isAuthorStill(context: ConversationRunContext, membershipCreatedAt: string) {
  return (
    context.userOrganization?.createdAt === membershipCreatedAt
    && (!ARE_CONVERSATIONS_STAFF_ONLY || context.user?.isAdministrator === true)
  )
}

export default runConversation
