import type { KnowledgeKind } from 'strategydance-core'

import readKnowledgeCatalogue from '~domain/knowledge/readKnowledgeCatalogue'
import toKnowledgeItem, { type KnowledgeItem } from '~domain/knowledge/toKnowledgeItem'

type ReadKnowledgeInput = {
  kind: KnowledgeKind
  // At most `MAX_KNOWLEDGE_READ_IDS`, each held to `KNOWLEDGE_ID_PATTERN`
  ids: string[]
}

export type ReadKnowledgeResult = {
  outcome: 'read'
  page: { kind: KnowledgeKind; items: KnowledgeItem[]; missing: string[] }
}

/*
  Items of a kind whole, in the order their ids were given, an id given twice read once. A directory
  is found among the inactive ones too, since the company may have submitted to it before. An id the
  kind's catalogue does not hold, another kind's among them, is named in `missing`
*/
function readKnowledge({ kind, ids }: ReadKnowledgeInput): ReadKnowledgeResult {
  const { items, inactive } = readKnowledgeCatalogue(kind)
  const found: KnowledgeItem[] = []
  const missing: string[] = []

  for (const id of new Set(ids)) {
    const entry = items.find(({ item }) => item.id === id) ?? inactive.find(({ item }) => item.id === id)

    if (entry) found.push(toKnowledgeItem(entry))
    else missing.push(id)
  }

  return { outcome: 'read', page: { kind, items: found, missing } }
}

export default readKnowledge
