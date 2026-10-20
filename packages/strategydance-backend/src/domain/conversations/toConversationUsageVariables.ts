import type { ConversationRunUsage } from '~domain/conversations/conversationRunUsage'
import { priceConversationUsageBound } from '~domain/conversations/priceConversationUsage'

/*
  What a write of a run's ledger sends of it: the ledger, and the most it may have cost, in whole
  microdollars rounded up, as the Int64 string the write upserts into the run's `RunSpend`, which the
  daily spend ceilings sum. Nothing for a write that carries no ledger, which leaves both as they were
*/
function toConversationUsageVariables(usage: ConversationRunUsage): { usage: ConversationRunUsage; costBound: string }
function toConversationUsageVariables(usage: ConversationRunUsage | undefined): {
  usage?: ConversationRunUsage
  costBound?: string
}
function toConversationUsageVariables(usage: ConversationRunUsage | undefined) {
  return usage ? { usage, costBound: String(Math.ceil(priceConversationUsageBound(usage))) } : {}
}

export default toConversationUsageVariables
