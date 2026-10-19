import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import {
  CONVERSATION_MAX_TOKENS,
  CONVERSATION_MODEL,
  CONVERSATION_TAGGING_MAX_TOKENS,
} from '~domain/agent/conversationRequestSettings'

// One request to Claude in a run's ledger
export type ConversationRequestUsage = {
  // The model that answered, a fallback's when one did, and why it stopped; null while reserved
  model: string | null
  stopReason: string | null
  inputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  outputTokens: number
  webSearchRequests: number
  // The system prompt's and the tools' share of its input, which the measurement sets against the
  // current one's when a release changed them
  configTokens: number
  // The position of the last stored entry its input carried
  inputEndPosition: number
  // Where the part it answered was stored, or null when it was not
  turnPosition: number | null
  // Its input as measured before it was sent
  estimatedInputTokens: number
  // Whether its figures are estimates: a worker taking over found it unsettled, or its stream
  // failed partway, before its output was counted
  isEstimated: boolean
  isSettled: boolean
  // What the models that declined it used before the API fell back, which its own figures leave
  // out; absent from a ledger written before M10
  declined?: ConversationDeclinedAttempt[]
  // `tagging` for the side request that tags the conversation with its aspects, which stores no
  // part, so its `turnPosition` stays null; absent for a request for the run's turn
  purpose?: 'tagging'
  // The most it could cost, in microdollars, as its reservation priced it, which the run's cost
  // limit counts it at until Claude's answer settles it; absent from a ledger written before M35
  worstCaseMicrodollars?: number
  // The model it names, which a worker taking it over unsettled charges it at; absent from a ledger
  // written before the review of M1 to M38, whose requests all named Opus 5.5
  requestedModel?: string
  // The most a request whose stream was cut partway may have cost, in microdollars, from how long
  // it streamed (`priceCutRequestBound`), which the cost limit and the daily spend ceilings count it
  // at rather than its whole reservation; absent from any other, and from a cut stream that showed
  // a fallback, whose declined attempt nothing bounds
  cutBoundMicrodollars?: number
}

// One attempt at a request a model declined partway, before the API fell back to another
export type ConversationDeclinedAttempt = {
  model: string
  inputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  outputTokens: number
}

export type ConversationModelUsage = {
  requests: number
  inputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  outputTokens: number
  webSearchRequests: number
}

/*
  What `ConversationRun.usage` holds, the ledger credits will be counted from: each request the run
  sent, reserved before it is sent and settled once it is answered, and the settled ones added up
  per model, an attempt a model declined under that model
*/
export type ConversationRunUsage = {
  requests: ConversationRequestUsage[]
  byModel: Record<string, ConversationModelUsage>
}

// A ledger as stored, its keys in whatever order `jsonb` gave them back, or an empty one
export function parseConversationRunUsage(value: unknown): ConversationRunUsage {
  const requests =
    typeof value === 'object' && value !== null && Array.isArray((value as { requests?: unknown }).requests)
      ? (value as { requests: unknown[] }).requests.filter(isRequestUsage)
      : []

  return withTotals(requests)
}

/*
  Reserves a request before it is sent, at its measured input, unsettled, and answers the ledger
  with the request's index. The write that sends it on its way carries the ledger, so a worker
  that dies with the request in flight leaves it to be charged
*/
export function reserveConversationRequest(
  usage: ConversationRunUsage,
  reservation: {
    estimatedInputTokens: number
    configTokens: number
    inputEndPosition: number
    purpose?: ConversationRequestUsage['purpose']
    worstCaseMicrodollars?: number
    requestedModel?: string
  },
) {
  const request: ConversationRequestUsage = {
    model: null,
    stopReason: null,
    inputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    webSearchRequests: 0,
    ...reservation,
    turnPosition: null,
    isEstimated: false,
    isSettled: false,
  }

  return { usage: withTotals([...usage.requests, request]), index: usage.requests.length }
}

// Settles a request from the message that answered it, with where its part was stored, if it was
export function settleConversationRequest(
  usage: ConversationRunUsage,
  index: number,
  message: BetaMessage,
  { turnPosition }: { turnPosition: number | null },
) {
  return withTotals(
    usage.requests.map((request, requestIndex) =>
      requestIndex === index
        ? {
            ...request,
            model: message.model,
            stopReason: message.stop_reason,
            inputTokens: message.usage.input_tokens,
            cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
            cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
            outputTokens: message.usage.output_tokens,
            webSearchRequests: message.usage.server_tool_use?.web_search_requests ?? 0,
            turnPosition,
            isSettled: true,
            declined: readDeclinedAttempts(message),
          }
        : request,
    ),
  )
}

// Settles a request Claude's API refused before it started answering, which it does not bill:
// nothing used, by no model
export function settleFailedConversationRequest(usage: ConversationRunUsage, index: number) {
  return withTotals(
    usage.requests.map((request, requestIndex) =>
      requestIndex === index ? { ...request, stopReason: 'error', isSettled: true } : request,
    ),
  )
}

/*
  Settles a request whose stream failed after it started, which is billed for what it had used: at
  the usage the stream last reported, its input counted at the start and its output only by the
  final delta, so marked as an estimate, with the most it may have cost for how long it streamed,
  when that bounds it
*/
export function settleInterruptedConversationRequest(
  usage: ConversationRunUsage,
  index: number,
  message: BetaMessage,
  { cutBoundMicrodollars }: { cutBoundMicrodollars?: number | null } = {},
) {
  const settled = settleConversationRequest(usage, index, message, { turnPosition: null })

  return withTotals(
    settled.requests.map((request, requestIndex) =>
      requestIndex === index
        ? {
            ...request,
            stopReason: 'error',
            isEstimated: true,
            ...(typeof cutBoundMicrodollars === 'number' ? { cutBoundMicrodollars } : {}),
          }
        : request,
    ),
  )
}

/*
  Records a request the run did not send, since the most it could cost would have taken the run
  past its cost limit: settled at nothing, by no model, so a side request is tried once a run, as
  one sent is
*/
export function skipConversationRequest(
  usage: ConversationRunUsage,
  skipped: { estimatedInputTokens: number; inputEndPosition: number; purpose?: ConversationRequestUsage['purpose'] },
) {
  const { usage: reserved, index } = reserveConversationRequest(usage, { ...skipped, configTokens: 0 })

  return withTotals(
    reserved.requests.map((request, requestIndex) =>
      requestIndex === index ? { ...request, stopReason: 'cost_limit', isSettled: true } : request,
    ),
  )
}

// Records where a request's part was stored, which the measurement starts from
export function placeConversationRequest(usage: ConversationRunUsage, index: number, turnPosition: number) {
  return withTotals(
    usage.requests.map((request, requestIndex) => (requestIndex === index ? { ...request, turnPosition } : request)),
  )
}

/*
  Charges every request a worker reserved and never settled, as one that takes the run over finds
  them: it was sent, and billed, so it counts at its measured input and the whole output it was
  allowed, a turn's or the tagging request's, marked as estimates
*/
export function chargeUnsettledRequests(usage: ConversationRunUsage) {
  if (usage.requests.every(({ isSettled }) => isSettled)) return usage

  return withTotals(
    usage.requests.map(request =>
      request.isSettled
        ? request
        : {
            ...request,
            model: request.model ?? request.requestedModel ?? CONVERSATION_MODEL,
            inputTokens: request.estimatedInputTokens,
            outputTokens: request.purpose === 'tagging' ? CONVERSATION_TAGGING_MAX_TOKENS : CONVERSATION_MAX_TOKENS,
            isEstimated: true,
            isSettled: true,
          },
    ),
  )
}

function withTotals(requests: ConversationRequestUsage[]): ConversationRunUsage {
  const byModel: Record<string, ConversationModelUsage> = {}

  for (const request of requests) {
    if (!request.isSettled || !request.model) continue

    const totals = (byModel[request.model] ??= {
      requests: 0,
      inputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      outputTokens: 0,
      webSearchRequests: 0,
    })

    totals.requests++
    totals.inputTokens += request.inputTokens
    totals.cacheReadInputTokens += request.cacheReadInputTokens
    totals.cacheCreationInputTokens += request.cacheCreationInputTokens
    totals.outputTokens += request.outputTokens
    totals.webSearchRequests += request.webSearchRequests

    for (const attempt of request.declined ?? []) {
      const declinedTotals = (byModel[attempt.model] ??= {
        requests: 0,
        inputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        outputTokens: 0,
        webSearchRequests: 0,
      })

      declinedTotals.inputTokens += attempt.inputTokens
      declinedTotals.cacheReadInputTokens += attempt.cacheReadInputTokens
      declinedTotals.cacheCreationInputTokens += attempt.cacheCreationInputTokens
      declinedTotals.outputTokens += attempt.outputTokens
    }
  }

  return { requests, byModel }
}

/*
  The attempts at a request that a model declined before the API fell back to another, as the
  message's iterations report them: the top-level usage counts the attempt that answered alone, and
  every iteration of a model other than the one that answered is one that declined. A request no
  model declined has none
*/
function readDeclinedAttempts(message: BetaMessage): ConversationDeclinedAttempt[] {
  return (message.usage.iterations ?? []).flatMap(iteration =>
    iteration.type === 'message' && iteration.model && iteration.model !== message.model
      ? [
          {
            model: iteration.model,
            inputTokens: iteration.input_tokens,
            cacheReadInputTokens: iteration.cache_read_input_tokens,
            cacheCreationInputTokens: iteration.cache_creation_input_tokens,
            outputTokens: iteration.output_tokens,
          },
        ]
      : [],
  )
}

function isRequestUsage(value: unknown): value is ConversationRequestUsage {
  if (typeof value !== 'object' || value === null) return false

  const request = value as Record<string, unknown>

  return (
    typeof request.inputTokens === 'number'
    && typeof request.outputTokens === 'number'
    && typeof request.isSettled === 'boolean'
    && typeof request.inputEndPosition === 'number'
  )
}
