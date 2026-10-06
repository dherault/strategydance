import type { PartialBlock } from '@blocknote/core'
import { blocksToYDoc } from '@blocknote/core/yjs'
import { getHeadlessRichTextEditor } from 'strategydance-design-system/lib/getHeadlessRichTextEditor'
import { parseRichText } from 'strategydance-design-system/lib/parseRichText'
import {
  RICH_TEXT_EDITOR_BLOCKS,
  RICH_TEXT_YJS_FRAGMENT,
  type RichTextEditorBlock,
  getRichTextBlockTypes,
} from 'strategydance-design-system/lib/richText'
import * as Y from 'yjs'

type Options = {
  // The blocks the editor that will open it writes, every one unless it says fewer
  blocks?: readonly RichTextEditorBlock[]
}

/*
  Rich text as it is stored, turned into the first update of a Yjs document that a shared editor
  opens on: a text stored before it was shared, or a draft about to be. BlockNote lays blocks into
  Yjs through an editor of the same schema, one never mounted.

  A text with no blocks is one empty paragraph rather than nothing. A shared editor opening on an
  empty document writes its first paragraph itself, and two tabs opening it at once would each
  write one, so the merged text would start with two. A value it cannot read is no blocks, as
  `parseRichText` has it
*/
function createRichTextYUpdate(value: string | null | undefined, { blocks = RICH_TEXT_EDITOR_BLOCKS }: Options = {}) {
  const parsed = parseRichText(value, { blockTypes: getRichTextBlockTypes(blocks) })
  const doc = blocksToYDoc(
    getHeadlessRichTextEditor(blocks),
    (parsed.length ? parsed : [{ type: 'paragraph' }]) as PartialBlock[],
    RICH_TEXT_YJS_FRAGMENT,
  )

  return Y.encodeStateAsUpdate(doc)
}

export { createRichTextYUpdate }
