import type { TextareaEdit } from '~utils/common/replaceTextareaRange'
import type { ConversationMentionQuery } from '~utils/conversation/findConversationMentionQuery'

/*
  What picking a document does to the mention being typed: its `@` and query become `@Title`,
  followed by a space to carry on typing after, unless one already follows
*/
function buildConversationMentionEdit(
  text: string,
  { at, query }: ConversationMentionQuery,
  title: string,
): TextareaEdit {
  const end = at + 1 + query.length
  const isSpaceFollowing = /\s/.test(text.charAt(end))

  return { start: at, end, insert: `@${title.trim()}${isSpaceFollowing ? '' : ' '}` }
}

export default buildConversationMentionEdit
