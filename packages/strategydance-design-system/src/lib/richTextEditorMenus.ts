import {
  type BlockNoteEditor,
  type BlockSchema,
  type Dictionary,
  editorHasBlockWithType,
  type InlineContentSchema,
  type StyleSchema,
} from '@blocknote/core'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import { type BlockTypeSelectItem, blockTypeSelectItems, getDefaultReactSlashMenuItems } from '@blocknote/react'
import { RICH_TEXT_HEADING_LEVELS, type RichTextHeadingLevel } from 'strategydance-design-system/lib/richText'

// What the slash menu offers, those of them the schema holds: the blocks, and none of the emoji
const SLASH_MENU_KEYS = new Set([
  'paragraph',
  'heading',
  'heading_2',
  'heading_3',
  'quote',
  'bullet_list',
  'numbered_list',
  'check_list',
])

/*
  The slash menu's items for `editor`, matched against what is typed after the slash. BlockNote's
  own, those the schema holds, since its defaults always add an emoji picker
*/
function getRichTextSlashMenuItems<B extends BlockSchema, I extends InlineContentSchema, S extends StyleSchema>(
  editor: BlockNoteEditor<B, I, S>,
) {
  // Each item keeps the key of the core item it is made from, which its type leaves out
  const items = getDefaultReactSlashMenuItems(editor).filter(
    item => 'key' in item && typeof item.key === 'string' && SLASH_MENU_KEYS.has(item.key),
  )

  return async (query: string) => filterSuggestionItems(items, query)
}

/*
  The formatting toolbar's block types, BlockNote's own with its three heading levels. Its defaults
  name a heading's toggle prop, which this heading does not have, so they would offer none
*/
function getRichTextBlockTypeSelectItems(dictionary: Dictionary): BlockTypeSelectItem[] {
  return blockTypeSelectItems(dictionary).flatMap(item => {
    if (item.type !== 'heading') return [item]

    const level = item.props?.level

    return isRichTextHeadingLevel(level) && !item.props?.isToggleable ? [{ ...item, props: { level } }] : []
  })
}

/*
  The block types an editor can turn a block into, those of the select's the editor's schema holds,
  as BlockNote's select keeps them. Each names its props' types, which is what the schema is asked
*/
function getRichTextBlockTypeItems<B extends BlockSchema, I extends InlineContentSchema, S extends StyleSchema>(
  editor: BlockNoteEditor<B, I, S>,
): BlockTypeSelectItem[] {
  return getRichTextBlockTypeSelectItems(editor.dictionary).filter(item =>
    editorHasBlockWithType(
      editor,
      item.type,
      Object.fromEntries(Object.entries(item.props ?? {}).map(([name, value]) => [name, typeof value])) as Record<
        string,
        'string' | 'number' | 'boolean'
      >,
    ),
  )
}

function isRichTextHeadingLevel(level: unknown): level is RichTextHeadingLevel {
  return RICH_TEXT_HEADING_LEVELS.some(headingLevel => headingLevel === level)
}

export { getRichTextBlockTypeItems, getRichTextBlockTypeSelectItems, getRichTextSlashMenuItems }
