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
  getConversationRunLedgers,
  reclaimConversationRun,
} from 'strategydance-database/backend'

import type { ClaudeClient, ConversationRunFence, ConversationRunReference } from '~types'

import {
  CONVERSATION_RUN_MAX_DURATION_MS,
  CONVERSATION_RUN_MAX_REQUESTS,
  CONVERSATION_RUN_STOP_CHECK_INTERVAL_MS,
  CONVERSATION_RUN_STREAM_DEADLINE_MS,
} from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import conversationClaudeClient from '~domain/agent/conversationClaudeClient'
import {
  type ConversationRunUsage,
  chargeUnsettledRequests,
  parseConversationRunUsage,
} from '~domain/conversations/conversationRunUsage'
import createConversationRunLease, { type ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import drawConversationTurn from '~domain/conversations/drawConversationTurn'
import endConversationRun, { type ConversationRunEnding } from '~domain/conversations/endConversationRun'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import requestConversationTurn, {
  type ConversationRunLimits,
  type ConversationTurnOutcome,
} from '~domain/conversations/requestConversationTurn'
import storeConversationParts from '~domain/conversations/storeConversationParts'

// How many steps a run takes at most, each a request, a message drawn or its end. A run draws at
// most 100 entries before it sends no further request, so only a loop that would never end reaches it
const MAX_RUN_STEPS = 4 * MAX_CONVERSATION_RUN_ENTRIES

// How many steps in a row may fail before the worker leaves the run to its lease
const MAX_FAILED_STEPS = 5

type Options = {
  client?: ClaudeClient
  // How long the worker waits after a failed step, times the failures in a row
  retryDelayMs?: number
  // The run's limits, which a test can bring in
  limits?: Partial<ConversationRunLimits>
  // How often a streaming request reads whether the run's member asked to stop it
  stopCheckIntervalMs?: number
}

const LIMITS: ConversationRunLimits = {
  maxRequests: CONVERSATION_RUN_MAX_REQUESTS,
  maxDurationMs: CONVERSATION_RUN_MAX_DURATION_MS,
  streamDeadlineMs: CONVERSATION_RUN_STREAM_DEADLINE_MS,
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

  - the run's reply not wholly drawn yet: the next message of it. The reply is the turn after the
    member's entry the run answers, its anchor, which a resumed run shares with the run it resumes,
    so it draws and carries on what that run left
  - a reply `pause_turn` paused, which a crash left stored part by part: its continuation
  - a reply wholly drawn: the run is complete, since no tool of the member's runs yet
  - the member's message: Claude's turn, stored part by part as it answered, unless the run has
    drawn its 100 entries, or the conversation holds its 2000, when the run fails with a note
    instead and costs nothing

  A run whose member asked it to stop sends no further request: it ends stopped, with its note, once
  what was paid for is written and drawn. One whose conversation was deleted stops without a note.

  What a request came to, the turn to store or the run's end, is kept until it is written, so a
  write refused once is tried again, never paid for again. Every write is fenced on the run's
  attempt and its author's membership, and the step after a refused one reads which it was: a run
  claimed again or ended by somebody else is left alone, a removed author's is interrupted, a
  deleted conversation's stops, and anything else, a counter an aspects note moved say, is tried
  again
*/
async function runConversation(
  reference: ConversationRunReference,
  {
    client = conversationClaudeClient,
    retryDelayMs = 500,
    limits,
    stopCheckIntervalMs = CONVERSATION_RUN_STOP_CHECK_INTERVAL_MS,
  }: Options = {},
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

  // Another worker claimed it first, or its author changed between the read and the claim, whose
  // run nothing else would end: a removed author's can no longer reach its page to reconcile it
  if (data.conversationRun_updateMany !== 1) {
    const claimedContext = await readContext(reference)
    const [claimedRun] = claimedContext.conversationRuns

    if (
      claimedRun
      && isInFlight(claimedRun.status)
      && claimedRun.attempts === run.attempts
      && !isAuthorStill(claimedContext, claimedRun.membershipCreatedAt)
    ) {
      return interruptBeforeClaiming(reference, claimedRun.attempts, claimedContext, retryDelayMs)
    }

    return 'held'
  }

  const fence: ConversationRunFence = {
    ...reference,
    attempts: run.attempts + 1,
    membershipCreatedAt: run.membershipCreatedAt,
  }
  const controller = new AbortController()
  const lease = createConversationRunLease({ fence, onLost: () => controller.abort() })

  try {
    return await takeSteps({
      fence,
      lease,
      signal: controller.signal,
      client,
      retryDelayMs,
      limits: { ...LIMITS, ...limits },
      stopCheckIntervalMs,
    })
  } finally {
    await lease.stop()
  }
}

type StepsInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  signal: AbortSignal
  client: ClaudeClient
  retryDelayMs: number
  limits: ConversationRunLimits
  stopCheckIntervalMs: number
}

async function takeSteps({ fence, lease, signal, client, retryDelayMs, limits, stopCheckIntervalMs }: StepsInput) {
  const reference = toReference(fence)
  let failedSteps = 0
  // What a request came to and is not written yet
  let outcome: ConversationTurnOutcome | null = null

  for (let step = 0; step < MAX_RUN_STEPS; step++) {
    const context = await readContext(reference)
    const [run] = context.conversationRuns

    if (run?.status !== ConversationRunStatus.RUNNING || run.attempts !== fence.attempts) return 'finished'

    try {
      const result = await takeStep({ context, fence, lease, signal, client, limits, stopCheckIntervalMs, outcome })

      outcome = result === 'ended' || result === 'next' ? null : result
      failedSteps = 0

      if (result === 'ended') return 'finished'
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
  // What a request came to and is not written yet, which this step writes
  outcome: ConversationTurnOutcome | null
}

/*
  Takes the run's next step, and answers `ended` once it ended the run, `next` when there is
  another, or what a request came to, for the next step to write. A run whose author left, or
  whose conversation was deleted, ends first, a turn not written yet included
*/
async function takeStep({
  context,
  fence,
  lease,
  signal,
  client,
  limits,
  stopCheckIntervalMs,
  outcome,
}: StepInput): Promise<'ended' | 'next' | ConversationTurnOutcome> {
  const { conversation } = context
  const [run] = context.conversationRuns
  const [entry] = context.conversationTranscriptEntries
  const position = conversation?.nextMessagePosition ?? 0
  // A request a worker reserved and never settled was sent, and is charged as such, unless the
  // worker holds what it came to
  const usage = readOutcomeUsage(outcome) ?? chargeUnsettledRequests(parseConversationRunUsage(run?.usage))

  async function end(ending: ConversationRunEnding) {
    await endConversationRun({ ending, fence, lease, position })

    return 'ended' as const
  }

  // Its member asked it to stop, which a run reads before each request: what was paid for is
  // written and drawn first, and nothing more is asked
  function stop() {
    return end({
      kind: 'noted',
      status: ConversationRunStatus.STOPPED,
      noteKind: ConversationNoteKind.STOPPED,
      failure: 'Its member stopped it before its next request',
      usage,
    })
  }

  if (!isAuthorStill(context, fence.membershipCreatedAt)) {
    return end({
      kind: 'interrupted',
      reference: toReference(fence),
      attempts: fence.attempts,
      failure: describeAuthorChange(context, fence.membershipCreatedAt),
    })
  }

  if (!conversation || conversation.deletedAt) {
    return end({ kind: 'finished', status: ConversationRunStatus.STOPPED, usage })
  }

  if (outcome) return (await writeOutcome({ outcome, context, fence, lease })) ? 'ended' : 'next'

  if (!entry) throw new Error('A run answers a transcript, and its conversation has none')
  if (entry.role === ConversationTranscriptRole.SYSTEM) throw new Error('A transcript never ends on a context message')

  if (entry.role === ConversationTranscriptRole.ASSISTANT) {
    // The turn answering the run's anchor: its own parts, and those of the run it resumed, which it
    // carries on
    const turn = (
      await readConversationTranscript(toReference(fence), { afterPosition: run?.anchorPosition ?? -1 })
    ).filter(({ role }) => role === ConversationTranscriptRole.ASSISTANT)
    const drawn = await drawConversationTurn({
      fence,
      lease,
      entries: turn.map(part => ({
        id: part.id,
        blocks: parseTranscriptContent(part.content),
        drawnBlocks: part.drawnBlocks,
        drawnPieces: part.drawnPieces,
      })),
      position,
    })

    if (drawn === 'drawn') return 'next'

    const ledgers = await readTurnLedgers(fence, turn, usage)
    const pausedRequest = findPausedRequest(entry, ledgers)

    if (!pausedRequest) return end({ kind: 'finished', status: ConversationRunStatus.COMPLETED, usage })
    if (run?.stopRequestedAt) return stop()

    return requestConversationTurn({
      fence,
      lease,
      signal,
      client,
      runContext: run?.context ?? null,
      usage,
      pausedRequest,
      storedPauses: countStoredPauses(turn, ledgers),
      startedAt: run?.startedAt ?? new Date().toISOString(),
      limits,
      stopCheckIntervalMs,
    })
  }

  if (run?.stopRequestedAt) return stop()

  if (context.conversationMessages.length >= MAX_CONVERSATION_RUN_ENTRIES) {
    return end({
      kind: 'noted',
      status: ConversationRunStatus.FAILED,
      noteKind: ConversationNoteKind.FAILED,
      failure: `The run drew its ${MAX_CONVERSATION_RUN_ENTRIES} entries`,
      usage,
    })
  }

  if (conversation.messageCount >= MAX_CONVERSATION_MESSAGES) {
    return end({
      kind: 'noted',
      status: ConversationRunStatus.FAILED,
      noteKind: ConversationNoteKind.FULL,
      failure: `The conversation holds its ${MAX_CONVERSATION_MESSAGES} messages`,
      usage,
    })
  }

  return requestConversationTurn({
    fence,
    lease,
    signal,
    client,
    runContext: run?.context ?? null,
    usage,
    pausedRequest: null,
    storedPauses: 0,
    startedAt: run?.startedAt ?? new Date().toISOString(),
    limits,
    stopCheckIntervalMs,
  })
}

type WriteOutcomeInput = {
  outcome: ConversationTurnOutcome
  context: ConversationRunContext
  fence: ConversationRunFence
  lease: ConversationRunLease
}

// Writes what a request came to, and answers whether that ended the run
async function writeOutcome({ outcome, context, fence, lease }: WriteOutcomeInput) {
  if (outcome.kind === 'ending') {
    await endConversationRun({
      ending: outcome.ending,
      fence,
      lease,
      position: context.conversation?.nextMessagePosition ?? 0,
    })

    return true
  }

  await storeConversationParts({
    fence,
    lease,
    turn: outcome,
    storedEntryIds: new Set(context.runEntries.map(({ id }) => id)),
  })

  return false
}

function readOutcomeUsage(outcome: ConversationTurnOutcome | null) {
  if (!outcome) return null
  if (outcome.kind === 'turn') return outcome.usage

  return outcome.ending.kind === 'interrupted' ? null : (outcome.ending.usage ?? null)
}

/*
  The ledgers that say how each of the turn's parts ended: this run's as the worker holds it, and
  those of the runs it carries the turn of, which crashes may have left several of, each with a
  part paused
*/
async function readTurnLedgers(fence: ConversationRunFence, turn: { runId: string }[], usage: ConversationRunUsage) {
  const ledgers = new Map([[fence.runId, usage]])
  const runIds = [...new Set(turn.map(({ runId }) => runId))].filter(runId => runId !== fence.runId)

  if (!runIds.length) return ledgers

  const { organizationId, userId, conversationId } = fence
  const { data } = await getConversationRunLedgers(dataConnect, { organizationId, userId, conversationId, runIds })

  for (const run of data.conversationRuns) ledgers.set(run.id, parseConversationRunUsage(run.usage))

  return ledgers
}

// The request whose part the transcript ends on, as the ledger of the run that stored it says,
// when `pause_turn` paused it: a crash came between storing it and the turn's next part
function findPausedRequest(
  entry: { position: number; run: { id: string } },
  ledgers: Map<string, ConversationRunUsage>,
) {
  return (
    ledgers
      .get(entry.run.id)
      ?.requests.find(({ turnPosition, stopReason }) => turnPosition === entry.position && stopReason === 'pause_turn')
    ?? null
  )
}

// How many of the turn's stored parts paused, each as its own run's ledger says, which count toward
// its five pauses
function countStoredPauses(turn: { position: number; runId: string }[], ledgers: Map<string, ConversationRunUsage>) {
  return turn.filter(({ position, runId }) =>
    ledgers
      .get(runId)
      ?.requests.some(({ turnPosition, stopReason }) => turnPosition === position && stopReason === 'pause_turn'),
  ).length
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
        ending: {
          kind: 'interrupted',
          reference,
          attempts,
          failure: describeAuthorChange(context, context.conversationRuns[0]?.membershipCreatedAt ?? ''),
        },
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

// Why a run's author no longer passes for it, for the logs
function describeAuthorChange(context: ConversationRunContext, membershipCreatedAt: string) {
  if (!context.userOrganization) return 'Its author left the organization'
  if (context.userOrganization.createdAt !== membershipCreatedAt)
    return 'Its author was invited back since it was queued'

  return 'Its author is no longer staff'
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
