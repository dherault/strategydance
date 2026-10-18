import { WEB_SEARCH_RESULT_TOKEN_ALLOWANCE } from '~constants'

import logger from '~utils/logger'

import {
  CLAUDE_FALLBACK_MODELS,
  CLAUDE_MODEL_PRICES,
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
  the final delta counts. A request reserved before M35, with no worst case, at its estimate
*/
export function priceConversationUsageBound(usage: ConversationRunUsage) {
  const charged = chargeUnsettledRequests(usage).requests

  return usage.requests.reduce((total, request, index) => {
    const isKnown = request.isSettled && !request.isEstimated
    const price =
      isKnown || request.worstCaseMicrodollars === undefined
        ? priceConversationRequest(charged[index] ?? request)
        : request.worstCaseMicrodollars

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
  allowance, at the cache-write rate, and the search's own price
*/
function priceAttemptWorstCase(model: string, { inputTokens, maxTokens, maxSearches }: Omit<WorstCaseInput, 'model'>) {
  const price = readModelPrice(model)
  const search =
    inputTokens * price.cacheRead + WEB_SEARCH_RESULT_TOKEN_ALLOWANCE * price.cacheWrite + WEB_SEARCH_PRICE_MICRODOLLARS

  return inputTokens * price.cacheWrite + maxTokens * price.output + maxSearches * search
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
