import type { ConversationAuthorFilter, ConversationSummary } from '~types'

// The conversations the list shows for whose it is asked to show, in the order it holds them
function filterConversationsByAuthor(
  conversations: ConversationSummary[],
  filter: ConversationAuthorFilter,
  viewerId: string | null,
) {
  if (filter === 'all') return conversations

  const authorId = filter === 'me' ? viewerId : filter.slice('user:'.length)

  return conversations.filter(conversation => conversation.user.id === authorId)
}

export default filterConversationsByAuthor
