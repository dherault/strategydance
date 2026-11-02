import type { ConversationAuthor, ConversationSummary } from '~types'

import getConversationAuthorName from '~utils/conversation/getConversationAuthorName'

// The members other than the reader who started a conversation the list holds, each once, by name,
// as the list's filter offers them: a member who left among them, their conversations kept
function listConversationAuthors(conversations: ConversationSummary[], viewerId: string | null) {
  const authors = new Map<string, ConversationAuthor>()

  for (const { user } of conversations) {
    if (user.id !== viewerId && !authors.has(user.id)) authors.set(user.id, user)
  }

  return [...authors.values()].sort((a, b) => getConversationAuthorName(a).localeCompare(getConversationAuthorName(b)))
}

export default listConversationAuthors
