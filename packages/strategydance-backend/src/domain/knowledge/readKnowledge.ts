import type { KnowledgeKind } from 'strategydance-core'

import type { ModuleCaller } from '~types'

import readKnowledgeCatalogue from '~domain/knowledge/readKnowledgeCatalogue'
import readKnowledgeState, { type KnowledgeItemState } from '~domain/knowledge/readKnowledgeState'
import toKnowledgeItem, { type KnowledgeItem } from '~domain/knowledge/toKnowledgeItem'

type ReadKnowledgeInput = {
  kind: KnowledgeKind
  // At most `MAX_KNOWLEDGE_READ_IDS`, each held to `KNOWLEDGE_ID_PATTERN`
  ids: string[]
}

export type ReadKnowledgeResult =
  | {
      outcome: 'read'
      page: { kind: KnowledgeKind; items: (KnowledgeItem & KnowledgeItemState)[]; missing: string[] }
    }
  | { outcome: 'notMember' }

/*
  Items of a kind whole, in the order their ids were given, an id given twice read once, each with
  what the organization keeps of it: its use and its links. A directory is found among the inactive
  ones too, since the company may have submitted to it before. An id the kind's catalogue does not
  hold, another kind's among them, is named in `missing`, and what the organization kept of it, from
  a release whose catalogue held it, is read past. A caller who is no longer the member the module
  read is refused
*/
async function readKnowledge(caller: ModuleCaller, { kind, ids }: ReadKnowledgeInput): Promise<ReadKnowledgeResult> {
  const { items, inactive } = readKnowledgeCatalogue(kind)
  const asked = [...new Set(ids)]
  const read = await readKnowledgeState(caller, kind, asked)

  if (read.outcome !== 'read') return read

  const found: (KnowledgeItem & KnowledgeItemState)[] = []
  const missing: string[] = []

  for (const id of asked) {
    const entry = items.find(({ item }) => item.id === id) ?? inactive.find(({ item }) => item.id === id)

    if (entry) found.push({ ...toKnowledgeItem(entry), ...read.states.get(id)! })
    else missing.push(id)
  }

  return { outcome: 'read', page: { kind, items: found, missing } }
}

export default readKnowledge
