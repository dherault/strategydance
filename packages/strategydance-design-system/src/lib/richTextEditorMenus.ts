import type { BlockNoteEditor, BlockSchema, Dictionary, InlineContentSchema, StyleSchema } from '@blocknote/core'
import { filterSuggestionItems } from '@blocknote/core/extensions'
import { type BlockTypeSelectItem, blockTypeSelectItems, getDefaultReactSlashMenuItems } from '@blocknote/react'

// What the slash menu offers, those of them the schema holds: the blocks, and none of the emoji
const SLASH_MENU_KEYS = new Set(['paragraph', 'heading_2', 'quote', 'bullet_list', 'numbered_list', 'check_list'])

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
  The formatting toolbar's block types, BlockNote's own with its one heading level. Its defaults
  name a heading's toggle prop, which this heading does not have, so they would offer none
*/
function getRichTextBlockTypeSelectItems(dictionary: Dictionary): BlockTypeSelectItem[] {
  return blockTypeSelectItems(dictionary)
    .filter(item => item.type !== 'heading' || (item.props?.level === 2 && item.props.isToggleable === false))
    .map(item => (item.type === 'heading' ? { ...item, props: { level: 2 } } : item))
}

export { getRichTextBlockTypeSelectItems, getRichTextSlashMenuItems }
