import { markdownToRichText } from 'strategydance-design-system/lib/markdownToRichText'
import { readRichTextYDocBlocks } from 'strategydance-design-system/lib/readRichTextYDocBlocks'
import {
  type RichTextYDocEdit,
  type UpdateRichTextYDocResult,
  updateRichTextYDoc,
} from 'strategydance-design-system/lib/updateRichTextYDoc'
import type * as Y from 'yjs'

import type { KnowledgeDocumentEdit, StoredKnowledgeDocumentText } from '~types'

import measureKnowledgeDocumentText from '~domain/knowledge/measureKnowledgeDocumentText'
import openKnowledgeDocumentText from '~domain/knowledge/openKnowledgeDocumentText'
import seedKnowledgeDocumentText from '~domain/knowledge/seedKnowledgeDocumentText'

type FoldKnowledgeDocumentEditResult =
  | {
      outcome: 'folded'
      state: string
      content: string
      contentText: string
      // The pending updates the fold merged, which it deletes
      updateIds: string[]
      // Whether the document had no snapshot, which the fold seeds, under `SeedDocumentState`'s condition
      isSeed: boolean
    }
  /** The snapshot cannot be merged */
  | { outcome: 'unreadableState' }
  | Exclude<ReturnType<typeof measureKnowledgeDocumentText>, { outcome: 'measured' }>
  | Exclude<UpdateRichTextYDocResult, { outcome: 'updated' }>

/*
  An agent's edit to a document's shared text, made as an editor makes one, and what storing it
  writes: the new snapshot, content and plain text, and the pending updates it merged. The edit is
  written into the snapshot with every pending update merged, as a difference, through
  `updateRichTextYDoc`, so a block it leaves alone keeps its id and whatever a member types in it
  meanwhile merges, and a push that lands while the fold is stored is not among those it merged and
  stays pending.

  A document with no snapshot yet is seeded from its content first, in the same write. A refusal,
  `updateRichTextYDoc`'s or a bound's, writes nothing
*/
function foldKnowledgeDocumentEdit(
  stored: StoredKnowledgeDocumentText,
  edit: KnowledgeDocumentEdit,
): FoldKnowledgeDocumentEditResult {
  const isSeed = stored.state === null
  const opened = openKnowledgeDocumentText({
    state: stored.state ?? seedKnowledgeDocumentText(stored.content),
    updates: stored.updates,
  })

  if (!opened) return { outcome: 'unreadableState' }

  const change = toRichTextYDocEdit(opened.doc, edit)

  if ('outcome' in change) return change

  const updated = updateRichTextYDoc(opened.doc, change)

  if (updated.outcome !== 'updated') return updated

  const measured = measureKnowledgeDocumentText(opened.doc)

  if (measured.outcome !== 'measured') return measured

  const { state, content, contentText } = measured

  return { outcome: 'folded', state, content, contentText, updateIds: opened.updateIds, isSeed }
}

// The edit in the stored model, a whole text replaced being every top-level block replaced
function toRichTextYDocEdit(
  doc: Y.Doc,
  edit: KnowledgeDocumentEdit,
): RichTextYDocEdit | Exclude<UpdateRichTextYDocResult, { outcome: 'updated' }> {
  if (edit.type === 'replaceText') return edit
  if (edit.type === 'append') return { type: 'append', blocks: markdownToRichText(edit.markdown) }

  const blocks = markdownToRichText(edit.markdown)

  if (edit.type === 'replaceBlocks') return { type: 'replaceBlocks', fromId: edit.fromId, toId: edit.toId, blocks }

  const read = readRichTextYDocBlocks(doc)

  if (!read) return { outcome: 'unknownContent' }

  const [first, last] = [read.at(0), read.at(-1)]

  if (!first || !last) return { outcome: 'notSeeded' }

  return { type: 'replaceBlocks', fromId: first.id, toId: last.id, blocks }
}

export default foldKnowledgeDocumentEdit
