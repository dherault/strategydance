// How many documents the list of knowledge to mention shows
const MAX_MENTION_SUGGESTIONS = 6

/*
  The documents a mention being typed suggests: those whose title holds the query, whatever its
  case, as the board's search matches, in the order they came in, the latest changed first, and
  six at most. A document without a title is never suggested, since there is nothing to type
*/
function filterConversationMentionDocuments<Document extends { title: string }>(
  documents: readonly Document[],
  query: string,
) {
  const words = query.toLocaleLowerCase()
  const matches: Document[] = []

  for (const document of documents) {
    const title = document.title.trim()

    if (!title || !title.toLocaleLowerCase().includes(words)) continue

    matches.push(document)

    if (matches.length === MAX_MENTION_SUGGESTIONS) break
  }

  return matches
}

export default filterConversationMentionDocuments
