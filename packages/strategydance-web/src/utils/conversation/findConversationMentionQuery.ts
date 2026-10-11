import findConversationMentions from '~utils/conversation/findConversationMentions'

// What is typed after an `@`, which the list of knowledge to mention matches titles against
export type ConversationMentionQuery = {
  // Where the `@` is
  at: number
  query: string
}

// An `@` that starts the text or follows a space, then up to the caret at most 40 characters on
// its line holding no other `@`, since a title can hold spaces
const QUERY_PATTERN = /(^|\s)@([^@\n]{0,40})$/

/*
  The mention being typed at the caret, or null when there is none: the caret moved off it, or
  the `@` starts a mention already picked, so a pick does not open the list again on the title it
  wrote. A mention changed by hand is no longer one, and its words are a query again
*/
function findConversationMentionQuery(
  text: string,
  caret: number,
  mentions: ReadonlyMap<string, string>,
): ConversationMentionQuery | null {
  const query = QUERY_PATTERN.exec(text.slice(0, caret))?.[2]

  if (query === undefined) return null

  const at = caret - query.length - 1

  if (findConversationMentions(text, mentions).some(({ start, end }) => start <= at && at < end)) return null

  return { at, query }
}

export default findConversationMentionQuery
