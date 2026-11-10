import type { KnowledgeKind } from 'strategydance-core'

import type { ModuleCaller } from '~types'

import { KNOWLEDGE_READ_NOTES_LENGTH } from '~constants'

import findKnowledgeEntry from '~domain/knowledge/findKnowledgeEntry'
import readKnowledgeState, { type KnowledgeItemState } from '~domain/knowledge/readKnowledgeState'
import toKnowledgeItem, { type KnowledgeItem } from '~domain/knowledge/toKnowledgeItem'
import toKnowledgeNoteAnswer, { type KnowledgeNoteAnswer } from '~domain/knowledge/toKnowledgeNoteAnswer'

type ReadKnowledgeInput = {
  kind: KnowledgeKind
  // At most `MAX_KNOWLEDGE_READ_IDS`, each held to `KNOWLEDGE_ID_PATTERN`
  ids: string[]
}

export type ReadKnowledgeResult =
  | {
      outcome: 'read'
      page: {
        kind: KnowledgeKind
        items: (KnowledgeItem & KnowledgeItemState & Partial<KnowledgeNoteAnswer>)[]
        missing: string[]
      }
    }
  | { outcome: 'notMember' }

/*
  Items of a kind whole, in the order their ids were given, an id given twice read once, each with
  what the organization keeps of it: its use and its links, and a directory its notes, the
  directories found sharing `KNOWLEDGE_READ_NOTES_LENGTH` evenly, so one read alone answers its
  notes whole. A directory is found among the inactive ones too, since the company may have
  submitted to it before. An id the kind's catalogue does not hold, another kind's among them, is
  named in `missing`, and what the organization kept of it, from a release whose catalogue held it,
  is read past. A caller who is no longer the member the module read is refused
*/
async function readKnowledge(caller: ModuleCaller, { kind, ids }: ReadKnowledgeInput): Promise<ReadKnowledgeResult> {
  const asked = [...new Set(ids)]
  const read = await readKnowledgeState(caller, kind, asked)

  if (read.outcome !== 'read') return read

  const entries = asked.map(id => ({ id, entry: findKnowledgeEntry(kind, id) }))
  const share = Math.floor(KNOWLEDGE_READ_NOTES_LENGTH / Math.max(1, entries.filter(({ entry }) => entry).length))
  const found: (KnowledgeItem & KnowledgeItemState & Partial<KnowledgeNoteAnswer>)[] = []
  const missing: string[] = []

  for (const { id, entry } of entries) {
    if (!entry) {
      missing.push(id)

      continue
    }

    found.push({
      ...toKnowledgeItem(entry),
      ...read.states.get(id)!,
      ...(entry.kind === 'DIRECTORY' && toKnowledgeNoteAnswer(read.notes.get(id)?.content ?? '', share)),
    })
  }

  return { outcome: 'read', page: { kind, items: found, missing } }
}

export default readKnowledge
