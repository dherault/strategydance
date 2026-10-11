// The cache entry of one conversation as its page or its dock's window reads it, which names whose
// read it is: the tab's cache outlives a sign-out
function getConversationQueryKey(organizationId: string | null, conversationId: string, viewerId: string | null) {
  return ['GetConversation', organizationId, conversationId, viewerId]
}

export default getConversationQueryKey
