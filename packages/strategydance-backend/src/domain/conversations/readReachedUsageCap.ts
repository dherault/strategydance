import { getCappedStarts, getDailySpend } from 'strategydance-database/backend'

import type { ReachedUsageCap, UsageCapKind, UsageCountKind } from '~types'

import { DAILY_SPEND_CEILINGS, IS_USAGE_CAPPED } from '~constants'

import { dataConnect } from '~firebase'

import { CONVERSATION_MAX_TOKENS, CONVERSATION_REQUEST_SETTINGS } from '~domain/agent/conversationRequestSettings'
import { WEB_SEARCH_MAX_USES } from '~domain/agent/conversationTools'
import readSubagentRequestSettings from '~domain/agent/subagentRequestSettings'
import findPassedSpendCeilings from '~domain/conversations/findPassedSpendCeilings'
import findReachedUsageCap from '~domain/conversations/findReachedUsageCap'
import { priceRequestWorstCase } from '~domain/conversations/priceConversationUsage'
import readSpendCeilingFreedAt from '~domain/conversations/readSpendCeilingFreedAt'

type Member = {
  organizationId: string
  userId: string
}

type Options = {
  // Whether the start finishes work under way, an answer's continuation, an Allow's or a reaction,
  // which passes a cap on starts up to one and a half times it, though never a spend ceiling
  isFinishing?: boolean
  // Whether what starts is a subagent's, whose requests its own settings answer
  isSubagent?: boolean
  // Whether the start needs no time a ceiling has room at, as a promotion, which waits for the next
  // reconcile, so the rows that say it are not read
  isTimeless?: boolean
}

/*
  Reads the daily cap a member's start of each kind given reaches, or null when every one has room
  (`findReachedUsageCap`), before the start stores anything, and again once its mutation's count
  refused it, to say which cap and when it has room: the route's count may have passed before another
  start took the place. Null wherever the caps are lifted, on the development backend.

  `spend` reads the daily spend ceilings beside them: a start is at one once its scope's runs may
  have cost so much that the least a request reserves, its output whole and its five searches, at
  its model, no longer fits, so nothing starts only to stop at its first request but over a large
  context. Of several caps and ceilings reached, the one that has room last
*/
async function readReachedUsageCap(
  member: Member,
  kinds: UsageCapKind[],
  { isFinishing = false, isSubagent = false, isTimeless = false }: Options = {},
): Promise<ReachedUsageCap | null> {
  if (!IS_USAGE_CAPPED) return null

  const counted = kinds.filter((kind): kind is UsageCountKind => kind !== 'spend')
  const [starts, spend] = await Promise.all([
    counted.length ? getCappedStarts(dataConnect, member) : null,
    kinds.includes('spend') ? getDailySpend(dataConnect, member) : null,
  ])
  const cap = starts ? findReachedUsageCap(starts.data, counted, { isFinishing }) : null

  if (!spend) return cap

  const read = (sum: { costBound_sum?: string | null }[]) => Number(sum[0]?.costBound_sum ?? 0)
  const [passed, ...alsoPassed] = findPassedSpendCeilings(
    { member: read(spend.data.member), account: read(spend.data.account), organization: read(spend.data.organization) },
    DAILY_SPEND_CEILINGS,
    readLeastRequestCost(isSubagent),
  )

  if (!passed) return cap
  if (isTimeless) return { kind: 'spend', scope: passed.scope, max: passed.max, retryAfterMs: 0 }

  const reached = await readSpendCeilingFreedAt(member, [passed, ...alsoPassed])
  const ceiling: ReachedUsageCap = {
    kind: 'spend',
    scope: reached.scope,
    max: reached.max,
    retryAfterMs: Math.max(0, reached.freesAt - Date.now()),
  }

  return cap && cap.retryAfterMs > ceiling.retryAfterMs ? cap : ceiling
}

// The least a request reserves at the model its runs ask, whatever its input: one attempt, its whole
// output and its five searches
function readLeastRequestCost(isSubagent: boolean) {
  const { model } = isSubagent ? readSubagentRequestSettings() : CONVERSATION_REQUEST_SETTINGS

  return priceRequestWorstCase({
    model,
    inputTokens: 0,
    maxTokens: CONVERSATION_MAX_TOKENS,
    maxSearches: WEB_SEARCH_MAX_USES,
  }).single
}

export default readReachedUsageCap
