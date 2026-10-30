// The order every list is kept in: by name, whatever its case and accents, where a reader looks
function compareKnowledgeNames(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
}

export default compareKnowledgeNames
