import type { ConversationAuthor } from '~types'

// What the pages call a conversation's author: the name on their account, or their address when
// they never gave one, as the team page calls a member
function getConversationAuthorName(author: ConversationAuthor) {
  return author.displayName || author.email
}

export default getConversationAuthorName
