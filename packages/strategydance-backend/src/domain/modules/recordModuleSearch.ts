import type { ModuleCaller } from '~types'

import recordConversationSearch from '~domain/conversations/recordConversationSearch'

type RecordModuleSearchResult =
  | { outcome: 'recorded' }
  | { outcome: 'notMember' }
  | { outcome: 'tooManySearches'; retryAfterMs: number }

/*
  What a module's search draws on before it searches. An external agent has no run to bound it, so
  each of its searches counts against the member's search allowance, which their own searches of
  their conversations share, and one past it is refused with when the next one fits. Strategy
  Dance's agent's searches are bounded by its tool calls per run instead, and never counted
*/
async function recordModuleSearch(caller: ModuleCaller): Promise<RecordModuleSearchResult> {
  if (caller.kind !== 'external') return { outcome: 'recorded' }

  const recorded = await recordConversationSearch({ organizationId: caller.organizationId, userId: caller.userId })

  if (recorded.outcome === 'forbidden') return { outcome: 'notMember' }
  if (recorded.outcome === 'tooMany') return { outcome: 'tooManySearches', retryAfterMs: recorded.retryAfterMs }

  return recorded
}

export default recordModuleSearch
