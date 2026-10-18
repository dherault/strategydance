import logger from '~utils/logger'

import {
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

export default priceConversationUsage
