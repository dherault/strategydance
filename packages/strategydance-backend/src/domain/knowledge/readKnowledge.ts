import type { KnowledgeKind } from 'strategydance-core'

import type { ModuleCaller } from '~types'

import { KNOWLEDGE_READ_LENGTH } from '~constants'

import findKnowledgeEntry from '~domain/knowledge/findKnowledgeEntry'
import hashKnowledgeNote from '~domain/knowledge/hashKnowledgeNote'
import readKnowledgeState, { type KnowledgeItemState } from '~domain/knowledge/readKnowledgeState'
import toKnowledgeItem, { type KnowledgeItem } from '~domain/knowledge/toKnowledgeItem'
import toKnowledgeNoteAnswers, { type KnowledgeNoteAnswer } from '~domain/knowledge/toKnowledgeNoteAnswers'

type ReadKnowledgeInput = {
  kind: KnowledgeKind
  // At most `MAX_KNOWLEDGE_READ_IDS`, each held to `KNOWLEDGE_ID_PATTERN`
  ids: string[]
}

type ReadItem = KnowledgeItem & KnowledgeItemState & Partial<KnowledgeNoteAnswer>

export type ReadKnowledgeResult =
  | { outcome: 'read'; page: { kind: KnowledgeKind; items: ReadItem[]; missing: string[] } }
  | { outcome: 'notMember' }

/*
  Items of a kind whole, in the order their ids were given, an id given twice read once, each with
  what the organization keeps of it: its use and its links, and a directory its notes, which take
  what the rest of the page leaves of `KNOWLEDGE_READ_LENGTH`, measured with every note whole but
  empty. A directory is found among the inactive ones too, since the company may have submitted to
  it before. An id the kind's catalogue does not hold, another kind's among them, is named in
  `missing`, and what the organization kept of it, from a release whose catalogue held it, is read
  past. A caller who is no longer the member the module read is refused
*/
async function readKnowledge(caller: ModuleCaller, { kind, ids }: ReadKnowledgeInput): Promise<ReadKnowledgeResult> {
  const asked = [...new Set(ids)]
  const read = await readKnowledgeState(caller, kind, asked)

  if (read.outcome !== 'read') return read

  const items: ReadItem[] = []
  const missing: string[] = []

  for (const id of asked) {
    const entry = findKnowledgeEntry(kind, id)

    if (entry) items.push({ ...toKnowledgeItem(entry), ...read.states.get(id)! })
    else missing.push(id)
  }

  if (kind !== 'DIRECTORY') return { outcome: 'read', page: { kind, items, missing } }

  const placeholder: KnowledgeNoteAnswer = { notes: '', isNotesComplete: true, notesVersion: hashKnowledgeNote('') }
  const frame = { kind, items: items.map(item => ({ ...item, ...placeholder })), missing }
  const notes = toKnowledgeNoteAnswers(
    items.map(item => read.notes.get(item.id)?.content ?? ''),
    KNOWLEDGE_READ_LENGTH - JSON.stringify(frame).length,
  )

  return { outcome: 'read', page: { kind, items: items.map((item, index) => ({ ...item, ...notes[index] })), missing } }
}

export default readKnowledge
