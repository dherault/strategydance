import type { KnowledgeKind } from 'strategydance-core'

import readKnowledgeCatalogue from '~domain/knowledge/readKnowledgeCatalogue'

/*
  An item of a kind by its id, as the release's catalogue holds it, a directory found among the
  inactive ones too, since the company may have submitted to it before. Undefined for an id the kind
  does not hold, which no write takes: the operations cannot read the package, so this holds them to
  it
*/
function findKnowledgeEntry(kind: KnowledgeKind, id: string) {
  const { items, inactive } = readKnowledgeCatalogue(kind)

  return items.find(({ item }) => item.id === id) ?? inactive.find(({ item }) => item.id === id)
}

export default findKnowledgeEntry
