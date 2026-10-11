import toCanonicalUuid from '~utils/toCanonicalUuid'

/*
  The idempotency scope a conversation's module calls are kept under, which the module never reads
  the meaning of: its agent's writes, each keyed with Claude's id for the call, and the prune that
  deletes them with the conversation. The id in Data Connect's form, so every caller writes the same
*/
function toConversationModuleScope(conversationId: string) {
  return `conversation:${toCanonicalUuid(conversationId)}`
}

export default toConversationModuleScope
