import { randomUUID } from 'node:crypto'

import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlock, BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_CONVERSATION_INPUT_TOKENS } from 'strategydance-core'
import {
  type CompanyAspect,
  ConversationNoteKind,
  ConversationRunStatus,
  ConversationTranscriptRole,
  getConversationRequestContext,
  getConversationRunStop,
  renewConversationRunLease,
} from 'strategydance-database/backend'

import type { ClaudeClient, ConversationRunFence } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import buildConversationContext, { type ConversationContext } from '~domain/agent/buildConversationContext'
import buildConversationRequest, {
  type ConversationRequestConfig,
  buildConversationMessages,
} from '~domain/agent/buildConversationRequest'
import checkTranscript from '~domain/agent/checkTranscript'
import {
  CONVERSATION_MAX_TOKENS,
  CONVERSATION_REQUEST_SETTINGS,
  MAX_CONVERSATION_PAUSES,
} from '~domain/agent/conversationRequestSettings'
import { WEB_SEARCH_MAX_USES } from '~domain/agent/conversationTools'
import measureConversationRequest from '~domain/agent/measureConversationRequest'
import stripBeforeFallback from '~domain/agent/stripBeforeFallback'
import toConversationProfile from '~domain/agent/toConversationProfile'
import {
  type ConversationRequestUsage,
  type ConversationRunUsage,
  parseConversationRunUsage,
  reserveConversationRequest,
  settleConversationRequest,
  settleFailedConversationRequest,
  settleInterruptedConversationRequest,
} from '~domain/conversations/conversationRunUsage'
import createConversationRequestSignal from '~domain/conversations/createConversationRequestSignal'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import type { ConversationRunEnding } from '~domain/conversations/endConversationRun'
import { priceConversationUsageBound, priceRequestWorstCase } from '~domain/conversations/priceConversationUsage'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'

type RequestConversationTurnInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  signal: AbortSignal
  client: ClaudeClient
  // The system prompt and the tools its requests send, the agent's own and its modules'
  config: ConversationRequestConfig
  // The run's context message as stored on it, JSON text, null until it is built
  runContext: string | null
  usage: ConversationRunUsage
  // When a crash left the turn paused, the request whose part is stored last, and how many of the
  // run's parts paused, which count toward its five pauses
  pausedRequest: ConversationRequestUsage | null
  storedPauses: number
  // When the run was first claimed, which its time limits count from
  startedAt: string
  limits: ConversationRunLimits
  // How often a streaming request reads whether the run's member asked to stop it
  stopCheckIntervalMs: number
}

// How many requests a run sends at most, how long after it was first claimed it starts none, when
// the stream of the one going then is cut, and what it may cost, in microdollars
export type ConversationRunLimits = {
  maxRequests: number
  maxDurationMs: number
  streamDeadlineMs: number
  maxCostMicrodollars: number
}

// A part of the turn, as Claude answered it, with its request in the ledger and the entry it is
// stored as
export type ConversationTurnPart = {
  content: BetaContentBlock[]
  requestIndex: number
  entryId: string
}

/*
  What a request to Claude came to, kept by the worker until it is written, so a write refused once
  is tried again rather than paid for again:

  - `turn`: the turn's parts to store, the first with the run's context when it is not stored yet,
    from `firstPosition` on, with the ledger they settle
  - `ending`: the run ends instead, full or failed, with what its requests used
  - `tagging`: the aspects the tagging request picked, or null when it picked none, with the ledger
    it settles (see `requestConversationTagging`)
*/
export type ConversationTurnOutcome =
  | {
      kind: 'turn'
      parts: ConversationTurnPart[]
      context: ConversationContext | null
      contextEntryId: string
      firstPosition: number
      usage: ConversationRunUsage
    }
  | { kind: 'ending'; ending: ConversationRunEnding }
  | { kind: 'tagging'; aspects: CompanyAspect[] | null; usage: ConversationRunUsage }

/*
  Asks Claude for the run's turn: reads the whole transcript, builds the run's context message once
  when it has none, checks the request, measures it, reserves it in the ledger in the write that
  renews the lease, then streams it, the progress lines its thinking gives going to the run's step.
  A turn `pause_turn` paused is sent back as it is, its parts held in memory, up to five pauses in
  the run, then answered as one outcome. A part a fallback model finished is kept as its boundary
  leaves it (`stripBeforeFallback`):

  - `end_turn`, or `tool_use` for a turn that calls Strategy Dance's own tools: the turn, to store
  - a request whose input would pass 800000 tokens: never sent, and the run ends full, its
    conversation marked so
  - `refusal`, which the API returns once the model it fell back to refused too: the run ends
    refused, with its note
  - an error of Claude's API, after the SDK's own retries, `max_tokens`, a sixth pause and any other
    stop: the run fails with its note, the request sent once, and charged what the stream reported
    it used when it failed partway
  - a run at one of its limits: 25 requests sent, or 10 minutes gone since it was first claimed,
    sends no further request, and a stream still going 14 minutes after the claim is cut, charged as
    one that failed partway. The run fails with its note
  - a request whose worst case, with what the run's ledger may have cost, would pass the run's $10
    (`priceRequestWorstCase`): never sent, and the run fails with its limits' note. One whose single
    attempt fits and whose fallback does not is sent without the fallback, and its worst case is
    recorded with its reservation, which the limit counts it at until its answer settles it
  - a stream its member asked to stop, which the worker reads every two seconds: cut, charged as
    one that failed partway, and the run ends stopped, with its note

  Nothing of a turn that ends so is stored, the parts held in memory included, and every ending
  says why in the run's `failure`, for the logs
*/
async function requestConversationTurn({
  fence,
  lease,
  signal,
  client,
  config,
  runContext,
  usage: initialUsage,
  pausedRequest,
  storedPauses,
  startedAt,
  limits,
  stopCheckIntervalMs,
}: RequestConversationTurnInput): Promise<ConversationTurnOutcome> {
  const reference = { organizationId: fence.organizationId, userId: fence.userId, conversationId: fence.conversationId }
  const [entries, { data: requestContext }] = await Promise.all([
    readConversationTranscript(reference),
    getConversationRequestContext(dataConnect, reference),
  ])
  const last = entries.at(-1)

  if (!last) throw new Error('A run answers a transcript, and its conversation has none')

  // The run's context message goes right after the member's entry it answers, until it is stored with
  // the run's first part. A run carrying on a part another run stored, as a resumed run carries on
  // a paused one, sends none: that run's went before it
  const isContextStored = entries.some(
    ({ role, runId }) => role === ConversationTranscriptRole.SYSTEM && runId === fence.runId,
  )
  const context =
    isContextStored || last.role !== ConversationTranscriptRole.USER
      ? null
      : (parseRunContext(runContext)
        ?? buildConversationContext({
          profile: toConversationProfile(requestContext),
          now: new Date(),
          lastContextHash:
            entries.findLast(({ role }) => role === ConversationTranscriptRole.SYSTEM)?.contextHash ?? null,
        }))
  // What each file the conversation sent takes, as its upload counted it, which the measurement adds
  // in place of the file blocks the count endpoint refuses, and for a subagent each its parent sent,
  // whose brief hands some over
  const fileTokens = new Map(
    [...requestContext.conversationAttachments, ...requestContext.parentAttachments].flatMap(
      ({ claudeFileId, tokenCount }) =>
        claudeFileId && typeof tokenCount === 'number' ? [[claudeFileId, tokenCount] as const] : [],
    ),
  )
  const otherRuns = requestContext.conversationRuns
    .filter(({ id }) => id !== fence.runId)
    .map(run => ({ id: run.id, usage: parseConversationRunUsage(run.usage) }))
  const parts: Omit<ConversationTurnPart, 'entryId'>[] = []
  const durationFailure = `The run passed ${limits.maxDurationMs / 1000} seconds since it was first claimed`
  const isPastDuration = () => Date.now() - Date.parse(startedAt) >= limits.maxDurationMs
  // Whether a fallback's boundary came in the turn, which strips its parts
  let isStripped = false
  // The parts of the turn, but those its stripping left bare, which are no part of it
  const keptParts = () => (isStripped ? parts.filter(({ content }) => content.length) : parts)
  let usage = initialUsage
  let paused = pausedRequest
  let pauses = storedPauses

  for (;;) {
    // A run at a limit sends no further request, which drops the parts of a turn held in memory
    if (usage.requests.length >= limits.maxRequests) {
      return { kind: 'ending', ending: fail(`The run sent its ${limits.maxRequests} requests`, usage, true) }
    }

    if (isPastDuration()) return { kind: 'ending', ending: fail(durationFailure, usage, true) }

    const messages = buildConversationMessages({
      entries,
      context: context?.content ?? null,
      parts: keptParts().map(({ content }) => content),
    })

    checkTranscript(messages, { isRequest: true })

    const measured = await measureConversationRequest({
      client,
      messages,
      config,
      entries: entries.map(({ position, runId }) => ({ position, runId })),
      runs: [{ id: fence.runId, usage }, ...otherRuns],
      pausedRequest: paused,
      fileTokens,
    })

    if (measured.inputTokens > MAX_CONVERSATION_INPUT_TOKENS) {
      logger.warn(
        `Conversation run ${fence.runId}: ${measured.inputTokens} input tokens, past the limit, the conversation is full`,
      )

      return {
        kind: 'ending',
        ending: {
          kind: 'noted',
          status: ConversationRunStatus.FAILED,
          noteKind: ConversationNoteKind.FULL,
          failure: `Its next request would take ${measured.inputTokens} input tokens, past ${MAX_CONVERSATION_INPUT_TOKENS}`,
          usage,
          isFull: true,
        },
      }
    }

    // Again once measured, since counting takes time of its own
    if (isPastDuration()) return { kind: 'ending', ending: fail(durationFailure, usage, true) }

    // What the run may have cost, and the most this request can, its fallback's attempt included
    const spent = priceConversationUsageBound(usage)
    const worstCase = priceRequestWorstCase({
      model: (config.settings ?? CONVERSATION_REQUEST_SETTINGS).model,
      inputTokens: measured.inputTokens,
      maxTokens: CONVERSATION_MAX_TOKENS,
      maxSearches: WEB_SEARCH_MAX_USES,
    })
    const hasFallbacks = spent + worstCase.withFallback <= limits.maxCostMicrodollars

    if (!hasFallbacks && spent + worstCase.single > limits.maxCostMicrodollars) {
      const failure = `Its next request could cost up to ${toDollars(worstCase.single)}, past the ${toDollars(limits.maxCostMicrodollars)} it may cost with ${toDollars(spent)} spent`

      logger.warn(`Conversation run ${fence.runId}: ${failure}`)

      return { kind: 'ending', ending: fail(failure, usage, true) }
    }

    const reserved = reserveConversationRequest(usage, {
      estimatedInputTokens: measured.inputTokens,
      configTokens: measured.configTokens,
      inputEndPosition: last.position,
      worstCaseMicrodollars: hasFallbacks ? worstCase.withFallback : worstCase.single,
    })

    usage = reserved.usage

    const reservedUsage = usage

    const { data: reservation } = await lease.write(() =>
      renewConversationRunLease(dataConnect, {
        ...fence,
        usage: reservedUsage,
        ...(context ? { context: JSON.stringify(context) } : {}),
      }),
    )

    // A run claimed again, or whose author left, is no longer this worker's, and its request is not
    // reserved: nothing is sent, and the step's next read finds out which
    if (reservation.conversationRun_updateMany !== 1) {
      throw new Error(`Conversation run ${fence.runId}: its reservation renewed nothing, the run is not this worker's`)
    }

    let message: BetaMessage
    // The message so far, once the stream has reported its usage
    const streamed: { message: BetaMessage | null } = { message: null }

    const request = createConversationRequestSignal({
      signal,
      deadline: Date.parse(startedAt) + limits.streamDeadlineMs,
      isStopRequested: async () => {
        const { data } = await getConversationRunStop(dataConnect, toReference(fence))

        return Boolean(data.conversationRuns[0]?.stopRequestedAt)
      },
      stopCheckIntervalMs,
    })

    try {
      message = await client.stream(buildConversationRequest(messages, config, { hasFallbacks }), {
        signal: request.signal,
        onProgress: line => lease.setStep(line),
        onUsage: snapshot => {
          streamed.message = snapshot
        },
      })
    } catch (error) {
      // What the stream used is charged as an estimate, its output counted only by the final delta,
      // or nothing when the API refused it before it started
      const settled = streamed.message
        ? settleInterruptedConversationRequest(usage, reserved.index, streamed.message)
        : settleFailedConversationRequest(usage, reserved.index)

      // Its member asked to stop it: the turn being written is dropped, the parts held with it
      if (request.readReason() === 'stopped') {
        logger.info(`Conversation run ${fence.runId}: stopped during request ${reserved.index}, as its member asked`)

        return {
          kind: 'ending',
          ending: {
            kind: 'noted',
            status: ConversationRunStatus.STOPPED,
            noteKind: ConversationNoteKind.STOPPED,
            failure: `Its member stopped it while request ${reserved.index} streamed`,
            usage: settled,
          },
        }
      }

      if (request.readReason() === 'deadline') {
        const failure = `The stream of request ${reserved.index} was cut ${limits.streamDeadlineMs / 1000} seconds after the run was first claimed`

        logger.warn(`Conversation run ${fence.runId}: ${failure}`)

        return { kind: 'ending', ending: fail(failure, settled, true) }
      }

      if (signal.aborted || !(error instanceof Anthropic.APIError)) throw error

      logger.error(`Conversation run ${fence.runId}: Claude's API failed request ${reserved.index}`, error)

      return { kind: 'ending', ending: fail(describeApiError(error, Boolean(streamed.message)), settled) }
    } finally {
      request.dispose()
    }

    logRequest(fence.runId, reserved.index, message)

    usage = settleConversationRequest(usage, reserved.index, message, { turnPosition: null })

    // What a model that declined partway wrote before its fallback took over is never kept, in this
    // part or in the parts of the turn before it
    const unstripped = [...parts.map(({ content }) => content), message.content]
    const turn = stripBeforeFallback(unstripped)

    if (turn !== unstripped) isStripped = true

    for (const [index, part] of parts.entries()) part.content = turn[index] ?? part.content

    const content = turn.at(-1) ?? message.content

    if (message.stop_reason === 'pause_turn' && pauses < MAX_CONVERSATION_PAUSES) {
      pauses++
      parts.push({ content, requestIndex: reserved.index })
      paused = usage.requests[reserved.index] ?? null

      continue
    }

    // Claude refused, and so did the model the API fell back to
    if (message.stop_reason === 'refusal') {
      const failure = `Claude refused request ${reserved.index}, ${message.stop_details?.category ?? 'no category'}, and so did its fallback`

      logger.warn(`Conversation run ${fence.runId}: ${failure}`)

      return {
        kind: 'ending',
        ending: {
          kind: 'noted',
          status: ConversationRunStatus.REFUSED,
          noteKind: ConversationNoteKind.REFUSED,
          failure,
          usage,
        },
      }
    }

    if (message.stop_reason !== 'end_turn' && message.stop_reason !== 'tool_use') {
      const failure =
        message.stop_reason === 'pause_turn'
          ? `Claude paused request ${reserved.index}, past the ${MAX_CONVERSATION_PAUSES} pauses a run takes`
          : `Claude stopped request ${reserved.index} on ${message.stop_reason}`

      logger.warn(`Conversation run ${fence.runId}: ${failure}`)

      return { kind: 'ending', ending: fail(failure, usage) }
    }

    parts.push({ content, requestIndex: reserved.index })

    return {
      kind: 'turn',
      parts: keptParts().map(part => ({ ...part, entryId: createId() })),
      context,
      contextEntryId: createId(),
      firstPosition: last.position + 1,
      usage,
    }
  }
}

// A run that failed, at one of its limits or not, which a subagent's report says
function fail(failure: string, usage: ConversationRunUsage, isAtLimit = false): ConversationRunEnding {
  return {
    kind: 'noted',
    status: ConversationRunStatus.FAILED,
    noteKind: ConversationNoteKind.FAILED,
    failure,
    usage,
    ...(isAtLimit ? { isAtLimit } : {}),
  }
}

// Microdollars as dollars and cents, as a failure says them
function toDollars(microdollars: number) {
  return `$${(microdollars / 1_000_000).toFixed(2)}`
}

// Why Claude's API failed a request, once the SDK's own retries were spent on what failed before
// its stream started
function describeApiError(error: InstanceType<typeof Anthropic.APIError>, hasStarted: boolean) {
  const answer = error.status ? `answered ${error.status}${error.type ? ` ${error.type}` : ''}` : error.name

  return hasStarted ? `Claude's API failed the stream partway: ${answer}` : `Claude's API ${answer} after its retries`
}

// The context the run kept, built by a worker before a crash, so it is sent as the same bytes
function parseRunContext(runContext: string | null): ConversationContext | null {
  if (!runContext) return null

  const context = JSON.parse(runContext) as Partial<ConversationContext>

  return typeof context.hash === 'string' && Array.isArray(context.content)
    ? { hash: context.hash, content: context.content }
    : null
}

// What a request used, and what the API changed of its input, which should be nothing
function logRequest(runId: string, index: number, message: BetaMessage) {
  const { usage } = message

  logger.info(
    `Conversation run ${runId}: request ${index} answered by ${message.model}, ${message.stop_reason}: ${usage.input_tokens} input, ${usage.cache_read_input_tokens ?? 0} read from the cache, ${usage.cache_creation_input_tokens ?? 0} written to it, ${usage.output_tokens} output, ${usage.server_tool_use?.web_search_requests ?? 0} web searches`,
  )

  if (message.input_transformations?.length) {
    logger.warn(
      `Conversation run ${runId}: request ${index}'s input was changed by the API: ${JSON.stringify(message.input_transformations)}`,
    )
  }
}

function createId() {
  return randomUUID().replaceAll('-', '')
}

// The run's keys alone, which a read takes
function toReference({ organizationId, userId, conversationId, runId }: ConversationRunFence) {
  return { organizationId, userId, conversationId, runId }
}

export default requestConversationTurn
