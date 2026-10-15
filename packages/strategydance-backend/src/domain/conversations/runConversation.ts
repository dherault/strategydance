import { randomUUID } from 'node:crypto'
import { setTimeout as wait } from 'node:timers/promises'

import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_CONVERSATION_MESSAGES, MAX_CONVERSATION_RUN_ENTRIES, buildConversationPreview } from 'strategydance-core'
import {
  ConversationMessageKind,
  ConversationNoteKind,
  ConversationRunStatus,
  ConversationRunTrigger,
  ConversationToolStatus,
  ConversationTranscriptRole,
  type GetConversationRunContextData,
  claimQueuedConversationRun,
  getConversationCalls,
  getConversationRunContext,
  getConversationRunLedgers,
  reclaimConversationRun,
  renewConversationRunLease,
  storeConversationToolResults,
  tagConversationAspects,
} from 'strategydance-database/backend'

import type {
  ClaudeClient,
  ConversationContentBlock,
  ConversationModules,
  ConversationRunFence,
  ConversationRunReference,
  ConversationToolRunner,
} from '~types'

import {
  CONVERSATION_RUN_MAX_DURATION_MS,
  CONVERSATION_RUN_MAX_REQUESTS,
  CONVERSATION_RUN_STOP_CHECK_INTERVAL_MS,
  CONVERSATION_RUN_STREAM_DEADLINE_MS,
  CONVERSATION_TOOL_CALL_TIMEOUT_MS,
  IS_CONVERSATIONS_RELEASE_GATED,
} from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'
import toCanonicalUuid from '~utils/toCanonicalUuid'

import type { ConversationRequestConfig } from '~domain/agent/buildConversationRequest'
import buildConversationTools from '~domain/agent/buildConversationTools'
import checkTranscript from '~domain/agent/checkTranscript'
import connectConversationModules from '~domain/agent/connectConversationModules'
import conversationClaudeClient from '~domain/agent/conversationClaudeClient'
import createConversationIntegrationRunners from '~domain/agent/createConversationIntegrationRunners'
import planConversationToolCalls, { type ConversationToolCallPlan } from '~domain/agent/planConversationToolCalls'
import readConversationToolCalls from '~domain/agent/readConversationToolCalls'
import CONVERSATION_SYSTEM_PROMPT from '~domain/agent/systemPrompt'
import buildConversationToolResults from '~domain/conversations/buildConversationToolResults'
import {
  type ConversationRunUsage,
  chargeUnsettledRequests,
  parseConversationRunUsage,
} from '~domain/conversations/conversationRunUsage'
import createConversationRunLease, { type ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import deriveConversationMessageId from '~domain/conversations/deriveConversationMessageId'
import drawConversationTurn from '~domain/conversations/drawConversationTurn'
import endConversationRun, { type ConversationRunEnding } from '~domain/conversations/endConversationRun'
import parseTranscriptContent from '~domain/conversations/parseTranscriptContent'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'
import requestConversationTagging from '~domain/conversations/requestConversationTagging'
import requestConversationTurn, {
  type ConversationRunLimits,
  type ConversationTurnOutcome,
} from '~domain/conversations/requestConversationTurn'
import runConversationToolCalls from '~domain/conversations/runConversationToolCalls'
import serializeTranscriptContent from '~domain/conversations/serializeTranscriptContent'
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
  // The modules the run's agent uses, connected for its member once the run is claimed, whose tools
  // its requests send and whose runners run its calls, which a test can bring in, and how long a
  // call may take
  connectModules?: (fence: ConversationRunFence) => Promise<ConversationModules>
  toolTimeoutMs?: number
  // What runs its calls to the organization's integrations, for its member, which a test can bring in
  createIntegrationRunners?: (fence: ConversationRunFence) => ConversationToolRunner[]
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
  else's run ends interrupted, with its note, so nothing is left for a later delivery. It connects
  to the modules its agent uses, as that member, whose tools its requests send after the agent's
  own. Then it takes one step at a time, each read afresh, so a worker taking over after a crash
  carries on where the last one stopped:

  - the run's reply not wholly drawn yet: the next message of it. The reply is the turn after the
    member's entry the run answers, its anchor, which a resumed run shares with the run it resumes,
    so it draws and carries on what that run left
  - a reply `pause_turn` paused, which a crash left stored part by part: its continuation
  - a reply wholly drawn that called Strategy Dance's own tools: the calls that have no result run,
    then the entry answering them all is stored and the run goes round to Claude. A reply that asked
    the member a question ends the run waiting for the answer instead
  - a reply wholly drawn that called nothing: the run is complete
  - before either ends the run, a reply wholly drawn to the conversation's first message, by its
    first run or one carrying it on, while nobody has set its aspects: the request that tags them
  - the member's message, or the results of the reply's calls: Claude's turn, stored part by part as
    it answered, unless the run has drawn its 100 entries, or the conversation holds its 2000, when
    the run fails with a note instead and costs nothing

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
    connectModules = connectConversationModules,
    toolTimeoutMs = CONVERSATION_TOOL_CALL_TIMEOUT_MS,
    createIntegrationRunners = createConversationIntegrationRunners,
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
  let modules: ConversationModules

  // Its claimed lease lapses, and the run is claimed again on its next delivery
  try {
    modules = await connectModules(fence)
  } catch (error) {
    logger.error(`Conversation run ${fence.runId}: could not connect to its modules, left to its lease`, error)

    return 'held'
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
      config: { system: CONVERSATION_SYSTEM_PROMPT, tools: buildConversationTools(modules.tools) },
      // The integration tools' runners always, whatever the organization added, so a turn is planned
      // the same by whoever takes it over
      runners: [...createIntegrationRunners(fence), ...modules.runners],
      toolTimeoutMs,
    })
  } finally {
    await lease.stop()
    await modules.close()
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
  // What the run's requests send besides their messages, and what runs their calls
  config: ConversationRequestConfig
  runners: ConversationToolRunner[]
  toolTimeoutMs: number
}

async function takeSteps({
  fence,
  lease,
  signal,
  client,
  retryDelayMs,
  limits,
  stopCheckIntervalMs,
  config,
  runners,
  toolTimeoutMs,
}: StepsInput) {
  const reference = toReference(fence)
  let failedSteps = 0
  // What a request came to and is not written yet
  let outcome: ConversationTurnOutcome | null = null

  for (let step = 0; step < MAX_RUN_STEPS; step++) {
    const context = await readContext(reference)
    const [run] = context.conversationRuns

    if (run?.status !== ConversationRunStatus.RUNNING || run.attempts !== fence.attempts) return 'finished'

    try {
      const result = await takeStep({
        context,
        fence,
        lease,
        signal,
        client,
        limits,
        stopCheckIntervalMs,
        config,
        runners,
        toolTimeoutMs,
        outcome,
      })

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
  config,
  runners,
  toolTimeoutMs,
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

  // Its member asked it to stop, which a run reads before each request and each call: what was
  // paid for is written and drawn first, and nothing more is asked or run
  function stop(failure = 'Its member stopped it before its next request') {
    return end({
      kind: 'noted',
      status: ConversationRunStatus.STOPPED,
      noteKind: ConversationNoteKind.STOPPED,
      failure,
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
    // What followed the run's anchor, which a resumed run shares with the run it carries on: its
    // replies, each that called tools followed by the results that answer them
    const sinceAnchor = await readConversationTranscript(toReference(fence), {
      afterPosition: run?.anchorPosition ?? -1,
    })
    const parts = sinceAnchor
      .filter(({ role }) => role === ConversationTranscriptRole.ASSISTANT)
      .map(part => ({ ...part, blocks: parseTranscriptContent(part.content) }))
    const plans = planCalls(parts, runners)
    const drawn = await drawConversationTurn({ fence, lease, entries: parts, plans, position })

    if (drawn === 'drawn') return 'next'

    // The reply the transcript ends on, its parts after the last results, or after the anchor
    const lastResultsPosition = sinceAnchor.findLast(({ role }) => role === ConversationTranscriptRole.USER)?.position
    const turn = parts.filter(({ position: partPosition }) => partPosition > (lastResultsPosition ?? -1))
    const ledgers = await readTurnLedgers(fence, turn, usage)
    const pausedRequest = findPausedRequest(entry, ledgers)
    const startedAt = run?.startedAt ?? new Date().toISOString()

    if (!pausedRequest) {
      const calls = readConversationToolCalls(parts.at(-1)?.blocks ?? [])
      const turnPlans = calls.flatMap(call => plans.get(call.id) ?? [])
      // Read from what the thread drew, since an approval is drawn only once the server is read
      const isWaiting = calls.length ? await isWaitingForMember(fence, calls) : false
      const isEnding = !calls.length || isWaiting

      // The first exchange is whole, and the reply ends the run, done or waiting for an answer:
      // Claude tags the conversation first, before the calls beside a question run, so none runs
      // twice
      if (isEnding && shouldTag({ context, usage, startedAt, limits })) {
        return requestConversationTagging({
          fence,
          lease,
          signal,
          client,
          usage,
          reply: parts.flatMap(({ blocks }) => blocks),
          streamDeadline: Date.parse(startedAt) + limits.streamDeadlineMs,
          stopCheckIntervalMs,
        })
      }

      if (!calls.length) return end({ kind: 'finished', status: ConversationRunStatus.COMPLETED, usage })

      const ran = await runConversationToolCalls({
        fence,
        lease,
        signal,
        plans: turnPlans,
        runners,
        deadline: Date.parse(startedAt) + limits.maxDurationMs,
        timeoutMs: toolTimeoutMs,
      })

      // A question or an approval is on the member's screen already, so the run waits for its
      // answer whatever else happened: a call a stop or the run's time kept from running is answered
      // as stopped, and cancelled, which the preview says when it shows that call
      if (isWaiting) {
        const shown = ran.messages.find(({ id }) => id === conversation.previewMessageId)
        const isShownCancelled =
          shown?.kind === ConversationMessageKind.TOOL_CALL
          && !ran.pending.has(shown.toolUseId ?? '')
          && (shown.toolStatus === ConversationToolStatus.RUNNING
            || shown.toolStatus === ConversationToolStatus.CANCELLED)

        return end({
          kind: 'waiting',
          usage,
          ...(isShownCancelled
            ? {
                preview: buildConversationPreview({
                  kind: 'TOOL_CALL',
                  toolName: shown.toolName,
                  toolStatus: ConversationToolStatus.CANCELLED,
                  integrationName: shown.integrationName,
                }),
              }
            : {}),
        })
      }
      if (ran.outcome === 'stopped') return stop('Its member stopped it before its next call')
      if (ran.outcome === 'expired') {
        return end({
          kind: 'noted',
          status: ConversationRunStatus.FAILED,
          noteKind: ConversationNoteKind.FAILED,
          failure: `The run passed ${limits.maxDurationMs / 1000} seconds since it was first claimed, before its next call`,
          usage,
        })
      }

      const results = buildConversationToolResults({
        calls,
        messages: ran.messages,
        pending: ran.pending,
        skipsQuestions: false,
      })
      /*
        A run an answer started that stores the results of a turn another run drew carried a waiting
        turn on to make the calls its member allowed, and is anchored on those results from then on,
        as a run its answers' entry started is: checked first, as that entry is checked before it is
        stored. A resume carries on the turn of the run it resumes too, and keeps that run's anchor
      */
      const isReanchored =
        run?.trigger === ConversationRunTrigger.ANSWER
        && toCanonicalUuid(entry.run?.id ?? '') !== toCanonicalUuid(fence.runId)

      if (isReanchored) {
        checkTranscript(
          [
            { role: 'assistant', content: parts.at(-1)?.blocks as BetaMessageParam['content'] },
            { role: 'user', content: results as BetaMessageParam['content'] },
          ],
          { isRequest: false, isTail: true },
        )
      }

      await lease.write(() =>
        storeConversationToolResults(dataConnect, {
          ...fence,
          entryId: randomUUID().replaceAll('-', ''),
          position: entry.position + 1,
          content: serializeTranscriptContent(results),
          ...(isReanchored && { anchorPosition: entry.position + 1 }),
        }),
      )

      return 'next'
    }

    if (run?.stopRequestedAt) return stop()

    return requestConversationTurn({
      fence,
      lease,
      signal,
      client,
      config,
      runContext: run?.context ?? null,
      usage,
      pausedRequest,
      storedPauses: countStoredPauses(turn, ledgers),
      startedAt,
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
    config,
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
  if (outcome.kind === 'tagging') {
    await writeTagging({ outcome, context, fence, lease })

    return false
  }

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

/*
  Writes what the tagging request came to: the aspects it picked, with their note, while nobody has
  set the conversation's aspects and it has room for the note, or its ledger alone otherwise, so
  the request is settled whatever it answered. A tag refused because the member's note moved the
  counter meanwhile is read again by the next step, which then finds the member's aspects
*/
async function writeTagging({
  outcome,
  context: { conversation },
  fence,
  lease,
}: WriteOutcomeInput & { outcome: Extract<ConversationTurnOutcome, { kind: 'tagging' }> }) {
  const { aspects, usage } = outcome

  if (aspects && conversation && !conversation.aspectsSetBy && conversation.messageCount < MAX_CONVERSATION_MESSAGES) {
    await lease.write(() =>
      tagConversationAspects(dataConnect, {
        ...fence,
        usage,
        aspects,
        noteId: deriveConversationMessageId(fence.runId, 'aspects'),
        position: conversation.nextMessagePosition,
      }),
    )

    return
  }

  const { data } = await lease.write(() => renewConversationRunLease(dataConnect, { ...fence, usage }))

  if (data.conversationRun_updateMany !== 1) {
    throw new Error(
      `Conversation run ${fence.runId}: its tagging's ledger renewed nothing, the run is not this worker's`,
    )
  }
}

/*
  Whether the run tags its conversation once its reply ends it: a run answering the conversation's
  first message, its first or one carrying it on, a resume or a retry, while nobody has set its
  aspects and it has room for the note. Not once its member asked to stop it, nor at its limits, its
  25 requests or its 10 minutes, and once a run, which its ledger says
*/
function shouldTag({
  context: { conversation, conversationRuns },
  usage,
  startedAt,
  limits,
}: {
  context: ConversationRunContext
  usage: ConversationRunUsage
  startedAt: string
  limits: ConversationRunLimits
}) {
  const [run] = conversationRuns

  return (
    run?.anchorPosition === 0
    && !run.stopRequestedAt
    && !!conversation
    && !conversation.aspectsSetBy
    && conversation.messageCount < MAX_CONVERSATION_MESSAGES
    && !usage.requests.some(({ purpose }) => purpose === 'tagging')
    && usage.requests.length < limits.maxRequests
    && Date.now() - Date.parse(startedAt) < limits.maxDurationMs
  )
}

function readOutcomeUsage(outcome: ConversationTurnOutcome | null) {
  if (!outcome) return null
  if (outcome.kind === 'turn' || outcome.kind === 'tagging') return outcome.usage

  return outcome.ending.kind === 'interrupted' ? null : (outcome.ending.usage ?? null)
}

/*
  Whether the turn the transcript ends on waits for the run's member: one of its questions not
  answered, or one of its calls to an integration waiting for their approval, as the thread drew them
*/
async function isWaitingForMember(fence: ConversationRunFence, calls: { id: string }[]) {
  const { organizationId, userId, conversationId } = fence
  const { data } = await getConversationCalls(dataConnect, {
    organizationId,
    userId,
    conversationId,
    toolUseIds: calls.map(({ id }) => id),
  })

  return data.conversationMessages.some(
    message =>
      (message.kind === ConversationMessageKind.QUESTION || message.kind === ConversationMessageKind.APPROVAL)
      && !message.answeredAt,
  )
}

/*
  What becomes of each call the run's replies made to Strategy Dance's own tools, by its id, as
  `planConversationToolCalls` plans it, counting each reply's calls after those of the replies
  before it
*/
function planCalls(parts: { blocks: ConversationContentBlock[] }[], runners: ConversationToolRunner[]) {
  const plans = new Map<string, ConversationToolCallPlan>()
  const runnerNames = runners.map(({ name }) => name)
  let callsBefore = 0

  for (const { blocks } of parts) {
    const calls = readConversationToolCalls(blocks)

    for (const plan of planConversationToolCalls(calls, { callsBefore, runnerNames })) plans.set(plan.call.id, plan)

    callsBefore += calls.length
  }

  return plans
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
// conversations are open to staff alone here
function isAuthorStill(context: ConversationRunContext, membershipCreatedAt: string) {
  return (
    context.userOrganization?.createdAt === membershipCreatedAt
    && (!IS_CONVERSATIONS_RELEASE_GATED || context.user?.isAdministrator === true)
  )
}

export default runConversation
