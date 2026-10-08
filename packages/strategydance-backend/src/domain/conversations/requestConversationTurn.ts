import { randomUUID } from 'node:crypto'

import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlock, BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { MAX_CONVERSATION_INPUT_TOKENS } from 'strategydance-core'
import {
  ConversationNoteKind,
  ConversationRunStatus,
  ConversationTranscriptRole,
  type GetConversationRequestContextData,
  getConversationRequestContext,
  renewConversationRunLease,
} from 'strategydance-database/backend'

import type { ClaudeClient, ConversationRunFence } from '~types'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

import buildConversationContext, {
  type ConversationContext,
  type ConversationProfile,
} from '~domain/agent/buildConversationContext'
import buildConversationRequest, { buildConversationMessages } from '~domain/agent/buildConversationRequest'
import checkTranscript from '~domain/agent/checkTranscript'
import { MAX_CONVERSATION_PAUSES } from '~domain/agent/conversationRequestSettings'
import measureConversationRequest from '~domain/agent/measureConversationRequest'
import stripBeforeFallback from '~domain/agent/stripBeforeFallback'
import {
  type ConversationRequestUsage,
  type ConversationRunUsage,
  parseConversationRunUsage,
  reserveConversationRequest,
  settleConversationRequest,
  settleFailedConversationRequest,
  settleInterruptedConversationRequest,
} from '~domain/conversations/conversationRunUsage'
import type { ConversationRunLease } from '~domain/conversations/createConversationRunLease'
import type { ConversationRunEnding } from '~domain/conversations/endConversationRun'
import readConversationTranscript from '~domain/conversations/readConversationTranscript'

type RequestConversationTurnInput = {
  fence: ConversationRunFence
  lease: ConversationRunLease
  signal: AbortSignal
  client: ClaudeClient
  // The run's context message as stored on it, JSON text, null until it is built
  runContext: string | null
  usage: ConversationRunUsage
  // When a crash left the turn paused, the request whose part is stored last, and how many of the
  // run's parts paused, which count toward its five pauses
  pausedRequest: ConversationRequestUsage | null
  storedPauses: number
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

/*
  Asks Claude for the run's turn: reads the whole transcript, builds the run's context message once
  when it has none, checks the request, measures it, reserves it in the ledger in the write that
  renews the lease, then streams it, the progress lines its thinking gives going to the run's step.
  A turn `pause_turn` paused is sent back as it is, its parts held in memory, up to five pauses in
  the run, then answered as one outcome. A part a fallback model finished is kept as its boundary
  leaves it (`stripBeforeFallback`):

  - `end_turn`: the turn, to store
  - a request whose input would pass 800000 tokens: never sent, and the run ends full, its
    conversation marked so
  - an error of Claude's API, after the SDK's own retries, and any other stop: the run fails with a
    note, the request sent once, and charged what the stream reported it used when it failed
    partway. M10 tells these apart
*/
async function requestConversationTurn({
  fence,
  lease,
  signal,
  client,
  runContext,
  usage: initialUsage,
  pausedRequest,
  storedPauses,
}: RequestConversationTurnInput): Promise<ConversationTurnOutcome> {
  const reference = { organizationId: fence.organizationId, userId: fence.userId, conversationId: fence.conversationId }
  const [entries, { data: requestContext }] = await Promise.all([
    readConversationTranscript(reference),
    getConversationRequestContext(dataConnect, reference),
  ])
  const last = entries.at(-1)

  if (!last) throw new Error('A run answers a transcript, and its conversation has none')

  const isContextStored = entries.some(
    ({ role, runId }) => role === ConversationTranscriptRole.SYSTEM && runId === fence.runId,
  )
  const context = isContextStored
    ? null
    : (parseRunContext(runContext)
      ?? buildConversationContext({
        profile: toProfile(requestContext),
        now: new Date(),
        lastContextHash:
          entries.findLast(({ role }) => role === ConversationTranscriptRole.SYSTEM)?.contextHash ?? null,
      }))
  const otherRuns = requestContext.conversationRuns
    .filter(({ id }) => id !== fence.runId)
    .map(run => ({ id: run.id, usage: parseConversationRunUsage(run.usage) }))
  const parts: Omit<ConversationTurnPart, 'entryId'>[] = []
  let usage = initialUsage
  let paused = pausedRequest
  let pauses = storedPauses

  for (;;) {
    const messages = buildConversationMessages({
      entries,
      context: context?.content ?? null,
      parts: parts.map(({ content }) => content),
    })

    checkTranscript(messages, { isRequest: true })

    const measured = await measureConversationRequest({
      client,
      messages,
      entries: entries.map(({ position, runId }) => ({ position, runId })),
      runs: [{ id: fence.runId, usage }, ...otherRuns],
      pausedRequest: paused,
    })

    if (measured.inputTokens > MAX_CONVERSATION_INPUT_TOKENS) {
      logger.warn(
        `Conversation run ${fence.runId}: ${measured.inputTokens} input tokens, past the limit, the conversation is full`,
      )

      return { kind: 'ending', ending: fail(ConversationNoteKind.FULL, usage, true) }
    }

    const reserved = reserveConversationRequest(usage, {
      estimatedInputTokens: measured.inputTokens,
      configTokens: measured.configTokens,
      inputEndPosition: last.position,
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

    try {
      message = await client.stream(buildConversationRequest(messages), {
        signal,
        onProgress: line => lease.setStep(line),
        onUsage: snapshot => {
          streamed.message = snapshot
        },
      })
    } catch (error) {
      if (signal.aborted || !(error instanceof Anthropic.APIError)) throw error

      logger.error(`Conversation run ${fence.runId}: Claude's API failed request ${reserved.index}`, error)

      return {
        kind: 'ending',
        ending: fail(
          ConversationNoteKind.FAILED,
          streamed.message
            ? settleInterruptedConversationRequest(usage, reserved.index, streamed.message)
            : settleFailedConversationRequest(usage, reserved.index),
        ),
      }
    }

    logRequest(fence.runId, reserved.index, message)

    usage = settleConversationRequest(usage, reserved.index, message, { turnPosition: null })

    // What a model that declined partway wrote before its fallback took over is never kept
    const content = stripBeforeFallback(message.content)

    if (message.stop_reason === 'pause_turn' && pauses < MAX_CONVERSATION_PAUSES) {
      pauses++
      parts.push({ content, requestIndex: reserved.index })
      paused = usage.requests[reserved.index] ?? null

      continue
    }

    if (message.stop_reason !== 'end_turn') {
      logger.warn(`Conversation run ${fence.runId}: request ${reserved.index} stopped on ${message.stop_reason}`)

      return { kind: 'ending', ending: fail(ConversationNoteKind.FAILED, usage) }
    }

    parts.push({ content, requestIndex: reserved.index })

    return {
      kind: 'turn',
      parts: parts.map(part => ({ ...part, entryId: createId() })),
      context,
      contextEntryId: createId(),
      firstPosition: last.position + 1,
      usage,
    }
  }
}

function fail(
  noteKind: ConversationNoteKind.FAILED | ConversationNoteKind.FULL,
  usage: ConversationRunUsage,
  isFull = false,
): ConversationRunEnding {
  return { kind: 'noted', status: ConversationRunStatus.FAILED, noteKind, usage, ...(isFull ? { isFull } : {}) }
}

// The context the run kept, built by a worker before a crash, so it is sent as the same bytes
function parseRunContext(runContext: string | null): ConversationContext | null {
  if (!runContext) return null

  const context = JSON.parse(runContext) as Partial<ConversationContext>

  return typeof context.hash === 'string' && Array.isArray(context.content)
    ? { hash: context.hash, content: context.content }
    : null
}

function toProfile(data: GetConversationRequestContextData): ConversationProfile {
  return {
    memberName: data.user?.displayName ?? null,
    jobTitle: data.userOrganization?.jobTitle ?? null,
    role: data.userOrganization?.role === 'ADMINISTRATOR' ? 'ADMINISTRATOR' : 'MEMBER',
    bio: data.user?.bio ?? null,
    locale: data.user?.locale ?? 'EN',
    timezone: data.user?.timezone ?? null,
    organizationName: data.organization?.name ?? '',
    brief: data.organization?.brief ?? null,
    exploredAspects: data.organization?.exploredAspects ?? [],
    aspects: data.conversations[0]?.aspects ?? [],
  }
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

export default requestConversationTurn
