/*
  Whether an item's name or description holds every word of a query, whatever its case, as
  `list_bills` matches a bill: the words lowercased already, each found in either field
*/
function matchesKnowledgeQuery({ name, description }: { name: string; description: string }, words: string[]) {
  const text = `${name}\n${description}`.toLowerCase()

  return words.every(word => text.includes(word))
}

export default matchesKnowledgeQuery
