import { BlockNoteEditor } from '@blocknote/core'
import type { RichTextEditorBlock } from 'strategydance-design-system/lib/richText'
import { createRichTextSchema } from 'strategydance-design-system/lib/richTextEditorSchema'

// One per set of blocks, made the first time it is asked for
const editors = new Map<string, ReturnType<typeof createEditor>>()

function createEditor(blocks: readonly RichTextEditorBlock[]) {
  return BlockNoteEditor.create({ schema: createRichTextSchema(blocks), trailingBlock: false })
}

/*
  An editor of the schema `RichTextEditor` writes `blocks` with, never mounted, for what BlockNote
  converts only through an editor: blocks into a Yjs document and back. Made once for each set of
  blocks and kept, since a document is converted at each compaction
*/
function getHeadlessRichTextEditor(blocks: readonly RichTextEditorBlock[]) {
  const key = [...blocks].sort().join()
  let editor = editors.get(key)

  if (!editor) {
    editor = createEditor(blocks)
    editors.set(key, editor)
  }

  return editor
}

export { getHeadlessRichTextEditor }
