import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'

import { WEB_SEARCH_RESULT_TOKEN_ALLOWANCE } from '~constants'

import logger from '~utils/logger'

import {
  CLAUDE_FALLBACK_MODELS,
  CLAUDE_MAX_OUTPUT_TOKENS_PER_SECOND,
  CLAUDE_MODEL_PRICES,
  CUT_STREAM_GRACE_MS,
  type ClaudeModelPrice,
  WEB_SEARCH_PRICE_MICRODOLLARS,
} from '~domain/agent/conversationRequestSettings'
import {
  type ConversationRequestUsage,
  type ConversationRunUsage,
  chargeUnsettledRequests,
} from '~domain/conversations/conversationRunUsage'

// The dearest of the models priced, for a model the table lacks, which is never priced at nothing
const DEAREST_PRICE = Object.values(CLAUDE_MODEL_PRICES).reduce((dearest, price) =>
  price.output > dearest.output ? price : dearest,
)

// A model's list prices, or the dearest's for a model the table lacks, which is logged
export function readModelPrice(model: string): ClaudeModelPrice {
  const price = CLAUDE_MODEL_PRICES[model]

  if (price) return price

  logger.warn(`Model ${model} has no price: it is priced as the dearest model`)

  return DEAREST_PRICE
}

type Tokens = {
  inputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  outputTokens: number
}

function priceTokens(model: string, tokens: Tokens) {
  const price = readModelPrice(model)

  return (
    tokens.inputTokens * price.input
    + tokens.cacheReadInputTokens * price.cacheRead
    + tokens.cacheCreationInputTokens * price.cacheWrite
    + tokens.outputTokens * price.output
  )
}

/*
  What one answer of a request no run's ledger holds cost, in microdollars, at list prices from its
  usage: the receipt reader's, which logs it
*/
export function priceClaudeMessage({ model, usage }: BetaMessage) {
  return priceTokens(model, {
    inputTokens: usage.input_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    outputTokens: usage.output_tokens,
  })
}

/*
  What one request of a run's ledger cost, in microdollars, at list prices from its figures: the
  model that answered it, the attempts other models declined before it, and its web searches. A
  request answered by no model, which the API refused before it started, cost nothing
*/
export function priceConversationRequest(request: ConversationRequestUsage) {
  const answered = request.model ? priceTokens(request.model, request) : 0
  const declined = (request.declined ?? []).reduce((total, attempt) => total + priceTokens(attempt.model, attempt), 0)

  return answered + declined + request.webSearchRequests * WEB_SEARCH_PRICE_MICRODOLLARS
}

/*
  What a run's ledger cost, in microdollars, at list prices, its side requests with it: each request
  from what it settled at, and each it reserved and never settled as a worker taking the run over
  charges it (`chargeUnsettledRequests`), as the credits will count them
*/
function priceConversationUsage(usage: ConversationRunUsage) {
  return chargeUnsettledRequests(usage).requests.reduce(
    (total, request) => total + priceConversationRequest(request),
    0,
  )
}

/*
  What a run's ledger may have cost at most, in microdollars, which its cost limit holds it to: a
  request Claude's answer settled at what it used, and any other at the worst case its reservation
  recorded, whatever was billed being unknown, one in flight, one a worker taking the run over
  charged at an estimate for the credits, and one whose stream failed partway, whose output only
  the final delta counts, at the most it may have cost for how long it streamed, when that bounds it,
  and never past its worst case. A request reserved before M35, with no worst case, at its estimate
*/
export function priceConversationUsageBound(usage: ConversationRunUsage) {
  const charged = chargeUnsettledRequests(usage).requests

  return usage.requests.reduce((total, request, index) => {
    const isKnown = request.isSettled && !request.isEstimated
    const price =
      isKnown || request.worstCaseMicrodollars === undefined
        ? priceConversationRequest(charged[index] ?? request)
        : Math.min(request.cutBoundMicrodollars ?? Number.POSITIVE_INFINITY, request.worstCaseMicrodollars)

    return total + price
  }, 0)
}

type WorstCaseInput = {
  // The model the request names
  model: string
  // Its input as measured before it is sent
  inputTokens: number
  maxTokens: number
  // How many web searches it may make, its tools' `max_uses`, none for a request without them
  maxSearches: number
}

/*
  The most one attempt at a request can cost, in microdollars: its whole input at the cache-write
  rate, as though the cache had expired, which five minutes, a worker's takeover or an eviction can
  bring about, its output at the whole `max_tokens`, and each search it may make as one more reading
  of its input, at the cache-read rate, the first reading having cached it within the request, as
  David chose on 2026-10-18 and `probe:claude` checks, what the search retrieves, as much as the
  allowance, at the cache-write rate, and the search's own price. Each step of the search loop reads
  again what every search before it retrieved, at the cache-read rate too, so the results of five
  searches are read ten times more than once each
*/
export function priceAttemptWorstCase(
  model: string,
  { inputTokens, maxTokens, maxSearches }: Omit<WorstCaseInput, 'model'>,
) {
  const price = readModelPrice(model)

  return (
    inputTokens * price.cacheWrite + maxTokens * price.output + priceSearchesWorstCase(price, inputTokens, maxSearches)
  )
}

// The most a request's searches can cost, each reading its input and the results before it again
function priceSearchesWorstCase(price: ClaudeModelPrice, inputTokens: number, searches: number) {
  const search =
    inputTokens * price.cacheRead + WEB_SEARCH_RESULT_TOKEN_ALLOWANCE * price.cacheWrite + WEB_SEARCH_PRICE_MICRODOLLARS
  const readingsAgain = (searches * (searches - 1)) / 2

  return searches * search + readingsAgain * WEB_SEARCH_RESULT_TOKEN_ALLOWANCE * price.cacheRead
}

/*
  The most a request whose stream was cut partway, by a stop, its deadline or a failure, may have
  cost, in microdollars, or null when nothing bounds it: its input as the stream's start billed it,
  each search its content shows as the worst case prices one, and its output at its model's top rate
  for as long as it streamed and a grace after (`CLAUDE_MAX_OUTPUT_TOKENS_PER_SECOND`), never past its
  `max_tokens`. Its reasoning is billed but never streamed, so the time is what says how much it
  wrote. A stream that showed a fallback, which bills the model that declined beside the one that
  answered, or by a model with no rate, has none, and counts at its reservation
*/
export function priceCutRequestBound({
  message,
  streamedMs,
  maxTokens,
}: {
  message: BetaMessage
  streamedMs: number
  maxTokens: number
}) {
  const rate = CLAUDE_MAX_OUTPUT_TOKENS_PER_SECOND[message.model]

  if (!rate || message.content.some(({ type }) => type === 'fallback')) return null

  const price = readModelPrice(message.model)
  const cacheRead = message.usage.cache_read_input_tokens ?? 0
  const cacheWrite = message.usage.cache_creation_input_tokens ?? 0
  const inputTokens = message.usage.input_tokens + cacheRead + cacheWrite
  const outputTokens = Math.min(maxTokens, Math.ceil(((streamedMs + CUT_STREAM_GRACE_MS) / 1000) * rate))
  const searches = message.content.filter(block => block.type === 'server_tool_use' && block.name === 'web_search')

  return (
    message.usage.input_tokens * price.input
    + cacheRead * price.cacheRead
    + cacheWrite * price.cacheWrite
    + outputTokens * price.output
    + priceSearchesWorstCase(price, inputTokens, searches.length)
  )
}

/*
  The most a request can cost, in microdollars: one attempt at the model it names, and with the API's
  fallback, a refusal's declined attempt billed beside the fallback that answers it, the second at
  the dearest model the fallback may route to (`CLAUDE_FALLBACK_MODELS`)
*/
export function priceRequestWorstCase({ model, ...request }: WorstCaseInput) {
  const single = priceAttemptWorstCase(model, request)
  const fallback = Math.max(
    0,
    ...(CLAUDE_FALLBACK_MODELS[model] ?? []).map(other => priceAttemptWorstCase(other, request)),
  )

  return { single, withFallback: single + fallback }
}

export default priceConversationUsage
