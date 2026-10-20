import { createHash } from 'node:crypto'

import { getHeadlessRichTextEditor } from 'strategydance-design-system/lib/getHeadlessRichTextEditor'
import { readRichTextYDocCopy } from 'strategydance-design-system/lib/readRichTextYDocCopy'
import { RICH_TEXT_EDITOR_BLOCKS } from 'strategydance-design-system/lib/richText'
import type * as Y from 'yjs'

/*
  A fingerprint of a document's shared text, by which a revision knows the text is still what an
  edit left, so nobody has written since and an Undo loses nothing, and an edit or a restore knows it
  changed nothing: a hash of the whole of what y-prosemirror reads from it, every node, attribute,
  mark and character, block ids included, read from a copy. Never the version `read_document` gives,
  which hashes the agent's Markdown and so misses what Markdown cannot say, a line break in a table's
  cell or a cell's alignment. Null when the text holds what this editor cannot read
*/
function fingerprintKnowledgeDocumentText(doc: Y.Doc) {
  const read = readRichTextYDocCopy(doc, getHeadlessRichTextEditor(RICH_TEXT_EDITOR_BLOCKS).pmSchema)

  if (!read) return null

  return createHash('sha256').update(JSON.stringify(read.root.toJSON())).digest('hex')
}

export default fingerprintKnowledgeDocumentText
