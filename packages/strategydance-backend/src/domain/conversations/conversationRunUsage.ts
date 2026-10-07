import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import { CONVERSATION_MAX_TOKENS, CONVERSATION_MODEL } from '~domain/agent/conversationRequestSettings'

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
  // Whether its figures are estimates, a worker taking over having found it unsettled
  isEstimated: boolean
  isSettled: boolean
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
  per model
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
  reservation: { estimatedInputTokens: number; configTokens: number; inputEndPosition: number },
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
          }
        : request,
    ),
  )
}

// Settles a request Claude's API failed, which it does not bill: nothing used, by no model
export function settleFailedConversationRequest(usage: ConversationRunUsage, index: number) {
  return withTotals(
    usage.requests.map((request, requestIndex) =>
      requestIndex === index ? { ...request, stopReason: 'error', isSettled: true } : request,
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
  allowed, marked as estimates
*/
export function chargeUnsettledRequests(usage: ConversationRunUsage) {
  if (usage.requests.every(({ isSettled }) => isSettled)) return usage

  return withTotals(
    usage.requests.map(request =>
      request.isSettled
        ? request
        : {
            ...request,
            model: request.model ?? CONVERSATION_MODEL,
            inputTokens: request.estimatedInputTokens,
            outputTokens: CONVERSATION_MAX_TOKENS,
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
  }

  return { requests, byModel }
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
