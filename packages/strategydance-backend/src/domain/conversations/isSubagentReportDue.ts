import { MAX_CONVERSATION_RUN_ENTRIES } from 'strategydance-core'

import { SUBAGENT_REPORT_ENTRY_MARGIN, SUBAGENT_REPORT_TIME_MS } from '~constants'

import { CONVERSATION_MAX_TOKENS } from '~domain/agent/conversationRequestSettings'
import { WEB_SEARCH_MAX_USES } from '~domain/agent/conversationTools'
import type { ConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import { priceConversationUsageBound, priceRequestWorstCase } from '~domain/conversations/priceConversationUsage'
import type { ConversationRunLimits } from '~domain/conversations/requestConversationTurn'

// How many characters of the results a token is reckoned to hold, fewer than prose does, so the
// next request is reckoned no smaller than it is
const RESULT_CHARACTERS_PER_TOKEN = 3

type Input = {
  usage: ConversationRunUsage
  limits: ConversationRunLimits
  // When the run was first claimed, which its ten minutes count from
  startedAt: string
  // How many entries the run has drawn, which its read counts to 100 at most
  entryCount: number
  // How many characters the results entry about to be stored holds, which the next request sends
  resultsLength: number
  // The model the run's requests name
  model: string
  // What the daily spend ceilings leave the run (`readRunSpendRoom`), held beside its $10, or null
  // where they are lifted
  spendRoom: number | null
}

/*
  Whether a subagent's fourth run asks for its report in the results entry it is about to store, as
  M42 settles it: once any of its budgets nears its end, so its next request is its last and its
  report is that request's reply, whichever limit comes first. Its 24th request sent; under two
  minutes left of its ten; within five of its 100 entries; or a ledger whose next request, reserved
  at its worst case as `requestConversationTurn` reserves it, would leave no room for one more
  attempt as dear, past the run's $10 or what the daily spend ceilings leave it. The next request is
  reckoned from the last one's input and output, and the results it adds, before it is measured
*/
function isSubagentReportDue({ usage, limits, startedAt, entryCount, resultsLength, model, spendRoom }: Input) {
  if (usage.requests.length >= limits.maxRequests - 1) return true
  if (Date.now() >= Date.parse(startedAt) + limits.maxDurationMs - SUBAGENT_REPORT_TIME_MS) return true
  if (entryCount >= MAX_CONVERSATION_RUN_ENTRIES - SUBAGENT_REPORT_ENTRY_MARGIN) return true

  const last = usage.requests.findLast(request => request.isSettled && !request.purpose)
  const spent = priceConversationUsageBound(usage)
  const worstCase = priceRequestWorstCase({
    model,
    inputTokens:
      (last ? last.estimatedInputTokens + last.outputTokens : 0)
      + Math.ceil(resultsLength / RESULT_CHARACTERS_PER_TOKEN),
    maxTokens: CONVERSATION_MAX_TOKENS,
    maxSearches: WEB_SEARCH_MAX_USES,
  })
  const maxCost = Math.min(limits.maxCostMicrodollars, spendRoom ?? Number.POSITIVE_INFINITY)
  const reserved = spent + worstCase.withFallback <= maxCost ? worstCase.withFallback : worstCase.single

  return spent + reserved + worstCase.single > maxCost
}

export default isSubagentReportDue
