import { markdownToRichText } from 'strategydance-design-system/lib/markdownToRichText'
import {
  type RichTextYDocEdit,
  type UpdateRichTextYDocResult,
  updateRichTextYDoc,
} from 'strategydance-design-system/lib/updateRichTextYDoc'
import * as Y from 'yjs'

import type { KnowledgeDocumentBlock, KnowledgeDocumentEdit, StoredKnowledgeDocumentText } from '~types'

import fingerprintKnowledgeDocumentText from '~domain/knowledge/fingerprintKnowledgeDocumentText'
import measureKnowledgeDocumentText from '~domain/knowledge/measureKnowledgeDocumentText'
import openKnowledgeDocumentText from '~domain/knowledge/openKnowledgeDocumentText'
import readKnowledgeDocumentBlocks from '~domain/knowledge/readKnowledgeDocumentBlocks'
import readKnowledgeDocumentContent from '~domain/knowledge/readKnowledgeDocumentContent'
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
      // A fingerprint of the text the edit left, which a revision keeps
      fingerprint: string
      // The text the edit replaced, which a revision keeps: its snapshot in base64, its content, for a
      // member to look at, and its fingerprint
      previous: { state: string; content: string; fingerprint: string }
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
  `updateRichTextYDoc`'s or a bound's, writes nothing.

  The text as it stood before the edit, every pending update merged, is read first, for the
  revision a member can go back to
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

  const blocks = readKnowledgeDocumentBlocks(opened.doc)
  const previousFingerprint = fingerprintKnowledgeDocumentText(opened.doc)

  if (!blocks || !previousFingerprint) return { outcome: 'unknownContent' }

  // Read before the snapshot is encoded, as `measureKnowledgeDocumentText` reads its text
  const previousContent = readKnowledgeDocumentContent(opened.doc)
  const previous = {
    state: Buffer.from(Y.encodeStateAsUpdate(opened.doc)).toString('base64'),
    content: previousContent,
    fingerprint: previousFingerprint,
  }
  const change = toRichTextYDocEdit(blocks, edit)

  if ('outcome' in change) return change

  const updated = updateRichTextYDoc(opened.doc, change)

  if (updated.outcome !== 'updated') return updated

  const measured = measureKnowledgeDocumentText(opened.doc)

  if (measured.outcome !== 'measured') return measured

  const { state, content, contentText } = measured
  const fingerprint = fingerprintKnowledgeDocumentText(opened.doc)

  if (!fingerprint) return { outcome: 'invalidEdit' }

  return { outcome: 'folded', state, content, contentText, updateIds: opened.updateIds, isSeed, fingerprint, previous }
}

// The edit in the stored model, a whole text replaced being every top-level block the text holds replaced
function toRichTextYDocEdit(
  read: readonly KnowledgeDocumentBlock[],
  edit: KnowledgeDocumentEdit,
): RichTextYDocEdit | Exclude<UpdateRichTextYDocResult, { outcome: 'updated' }> {
  if (edit.type === 'replaceText') return edit
  if (edit.type === 'append') return { type: 'append', blocks: markdownToRichText(edit.markdown) }

  const blocks = markdownToRichText(edit.markdown)

  if (edit.type === 'replaceBlocks') return { type: 'replaceBlocks', fromId: edit.fromId, toId: edit.toId, blocks }

  const [first, last] = [read.at(0), read.at(-1)]

  if (!first || !last) return { outcome: 'notSeeded' }

  return { type: 'replaceBlocks', fromId: first.id, toId: last.id, blocks }
}

export default foldKnowledgeDocumentEdit
