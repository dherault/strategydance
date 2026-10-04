import { yDocToBlocks } from '@blocknote/core/yjs'
import { getHeadlessRichTextEditor } from 'strategydance-design-system/lib/getHeadlessRichTextEditor'
import { getRichTextText } from 'strategydance-design-system/lib/getRichTextText'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import {
  RICH_TEXT_EDITOR_BLOCKS,
  RICH_TEXT_YJS_FRAGMENT,
  type RichTextEditorBlock,
  getRichTextBlockTypes,
} from 'strategydance-design-system/lib/richText'
import type * as Y from 'yjs'

type Options = {
  // The blocks the editor writing in it writes, every one unless it says fewer
  blocks?: readonly RichTextEditorBlock[]
}

/*
  The text of a shared document as it is stored: the blocks `normalizeRichText` keeps, serialized,
  as a `RichTextEditor` reports them, and whether they hold any text. It reads the document itself
  rather than what an editor last reported, so it holds every edit merged into it, an editor on
  the page or not
*/
function readRichTextYDoc(doc: Y.Doc, { blocks = RICH_TEXT_EDITOR_BLOCKS }: Options = {}) {
  const editor = getHeadlessRichTextEditor(blocks)
  const document = normalizeRichText(yDocToBlocks(editor, doc, RICH_TEXT_YJS_FRAGMENT), {
    blockTypes: getRichTextBlockTypes(blocks),
  })

  return { value: JSON.stringify(document), isEmpty: getRichTextText(document).trim() === '' }
}

export { readRichTextYDoc }
