import { yDocToBlocks } from '@blocknote/core/yjs'
import { getHeadlessRichTextEditor } from 'strategydance-design-system/lib/getHeadlessRichTextEditor'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import { readRichTextYDocCopy } from 'strategydance-design-system/lib/readRichTextYDocCopy'
import {
  RICH_TEXT_EDITOR_BLOCKS,
  RICH_TEXT_YJS_FRAGMENT,
  type RichTextBlock,
  type RichTextEditorBlock,
  getRichTextBlockTypes,
} from 'strategydance-design-system/lib/richText'
import type * as Y from 'yjs'

/** A top-level block of a shared text: its id, which stays with it while others are typed around it, and what it stores as */
export type RichTextYDocBlock = {
  id: string
  /** The block as `normalizeRichText` keeps it, with whatever is nested under it: one block, or none for one that keeps nothing */
  value: RichTextBlock[]
}

type Options = {
  // The blocks the editor writing in it writes, every one unless it says fewer
  blocks?: readonly RichTextEditorBlock[]
}

/*
  The top-level blocks of a shared text, each with its id, for what names a block by it, as an
  edit through `updateRichTextYDoc` does: the stored model has no ids, so `readRichTextYDoc` has
  none to give. Null when the text holds what the schema cannot read, a newer editor's block say,
  which a read would delete, and when it holds no text yet, which a seed writes first.

  BlockNote reads the copy the check read, which it reads as the check did, so nothing is deleted
  from the document itself and the ids are those `updateRichTextYDoc` finds blocks by. An empty
  paragraph is a block like any other, with an id an edit can name
*/
function readRichTextYDocBlocks(
  doc: Y.Doc,
  { blocks = RICH_TEXT_EDITOR_BLOCKS }: Options = {},
): RichTextYDocBlock[] | null {
  const editor = getHeadlessRichTextEditor(blocks)
  const read = readRichTextYDocCopy(doc, editor.pmSchema)

  if (!read) return null

  const blockTypes = getRichTextBlockTypes(blocks)

  return yDocToBlocks(editor, read.copy, RICH_TEXT_YJS_FRAGMENT).map(block => ({
    id: block.id,
    value: normalizeRichText([block], { blockTypes }),
  }))
}

export { readRichTextYDocBlocks }
