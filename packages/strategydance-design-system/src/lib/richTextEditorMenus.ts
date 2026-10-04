import {
  type BlockNoteEditor,
  type BlockSchema,
  type Dictionary,
  editorHasBlockWithType,
  type InlineContentSchema,
  type StyleSchema,
} from '@blocknote/core'
import {
  FilePanelExtension,
  FormattingToolbarExtension,
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from '@blocknote/core/extensions'
import {
  type BlockTypeSelectItem,
  type DefaultReactSuggestionItem,
  blockTypeSelectItems,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react'
import { SquareCodeIcon, SquarePlayIcon } from 'lucide-react'
import { createElement } from 'react'
import type { RichTextDictionary } from 'strategydance-design-system/lib/getRichTextDictionary'
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
  'code_block',
  'table',
  'image',
])

/*
  The slash menu's items for `editor`, matched against what is typed after the slash. BlockNote's
  own, those the schema holds, since its defaults always add an emoji picker, then the blocks of
  the editor's own after BlockNote's last media one, in its group
*/
function getRichTextSlashMenuItems<B extends BlockSchema, I extends InlineContentSchema, S extends StyleSchema>(
  editor: BlockNoteEditor<B, I, S>,
) {
  // Each item keeps the key of the core item it is made from, which its type leaves out
  const items = getDefaultReactSlashMenuItems(editor).filter(
    item => 'key' in item && typeof item.key === 'string' && SLASH_MENU_KEYS.has(item.key),
  )
  const media = getMediaItems(editor)
  const index = items.findLastIndex(item => item.group === editor.dictionary.slash_menu.image.group) + 1 || items.length
  const all = [...items.slice(0, index), ...media, ...items.slice(index)]

  return async (query: string) => filterSuggestionItems(all, query)
}

/*
  The items for the editor's blocks BlockNote has none for: a YouTube, Vimeo or Loom video. Each
  inserts its block and opens the panel its address is given in, as BlockNote's picture does
*/
function getMediaItems<B extends BlockSchema, I extends InlineContentSchema, S extends StyleSchema>(
  editor: BlockNoteEditor<B, I, S>,
): DefaultReactSuggestionItem[] {
  const dictionary = editor.dictionary as RichTextDictionary

  function insert(type: string) {
    const block = insertOrUpdateBlockForSlashMenu(editor, { type } as never)

    editor.getExtension(FilePanelExtension)?.showMenu(block.id)
    // Hidden as BlockNote hides it for a picture, for a block inserted at the end of the text
    editor.getExtension(FormattingToolbarExtension)?.store.setState(false)
  }

  return 'videoEmbed' in editor.schema.blockSchema
    ? [
        {
          title: dictionary.slash_menu.video.title,
          subtext: dictionary.rich_text.video_embed_subtext,
          aliases: ['video', 'youtube', 'vimeo', 'loom', 'embed'],
          group: dictionary.slash_menu.video.group,
          icon: createElement(SquarePlayIcon, { size: 18 }),
          onItemClick: () => insert('videoEmbed'),
        },
      ]
    : []
}

/*
  The formatting toolbar's block types, BlockNote's own with its three heading levels, then code,
  which BlockNote's leave out. Its defaults name a heading's toggle prop, which this heading does
  not have, so they would offer none
*/
function getRichTextBlockTypeSelectItems(dictionary: Dictionary): BlockTypeSelectItem[] {
  const items = blockTypeSelectItems(dictionary).flatMap(item => {
    if (item.type !== 'heading') return [item]

    const level = item.props?.level

    return isRichTextHeadingLevel(level) && !item.props?.isToggleable ? [{ ...item, props: { level } }] : []
  })

  return [...items, { name: dictionary.slash_menu.code_block.title, type: 'codeBlock', icon: SquareCodeIcon }]
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
