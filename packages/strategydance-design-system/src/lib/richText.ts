import type { EditorThemeClasses } from 'lexical'

/*
  How rich text looks, shared by the editor and the renderer so a post reads the same while it is
  written and once it is posted. Lexical puts these classes on the nodes it draws, and `RichText`
  on the elements it builds from the same serialized nodes.

  Preflight strips list markers, so the lists name theirs
*/
const richTextClassName = 'text-[15px] leading-[1.6] wrap-anywhere text-pretty text-secondary [&>:last-child]:mb-0'

const richTextTheme = {
  paragraph: 'mb-2',
  heading: {
    h2: 'mt-1 mb-1.5 font-display text-xl leading-[1.25] font-normal tracking-normal text-secondary',
  },
  quote: 'mb-2 border-l-2 border-neutral-300 pl-3 text-neutral-600',
  list: {
    ul: 'mb-2 list-disc pl-[22px]',
    ol: 'mb-2 list-decimal pl-[22px]',
    listitem: 'my-0.5',
    // An item holding a nested list draws no marker of its own: the nested list's items do
    nested: {
      listitem: 'list-none',
    },
  },
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: '[text-decoration-line:underline_line-through]',
  },
} satisfies EditorThemeClasses

export const RICH_TEXT_CLASS_NAME = richTextClassName
export const RICH_TEXT_THEME = richTextTheme

// Lexical's text format bits, the four the toolbar sets. Any other bit a value carries is ignored
export const RICH_TEXT_FORMAT_BOLD = 1
export const RICH_TEXT_FORMAT_ITALIC = 2
export const RICH_TEXT_FORMAT_STRIKETHROUGH = 4
export const RICH_TEXT_FORMAT_UNDERLINE = 8

/*
  Rich text as it is stored: BlockNote's blocks, kept to what the editor writes and the renderer
  draws. A block is BlockNote's partial block, without the id it is given in the editor and without
  any prop left at its default, so that the same document always serializes to the same string
*/

/** The blocks rich text is written in, by BlockNote's names */
export type RichTextBlockType =
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'bulletListItem'
  | 'numberedListItem'
  | 'checkListItem'

/** The four styles a run of text may carry, each present only when it is on */
export type RichTextStyles = {
  bold?: true
  italic?: true
  underline?: true
  strike?: true
}

export type RichTextRun = {
  type: 'text'
  text: string
  styles?: RichTextStyles
}

/** A link, only ever to a web or mail address */
export type RichTextLink = {
  type: 'link'
  href: string
  content: RichTextRun[]
}

export type RichTextInline = RichTextRun | RichTextLink

export type RichTextBlock = {
  type: RichTextBlockType
  /** A numbered list's first number when it is not 1, and a check item's tick */
  props?: {
    start?: number
    checked?: true
  }
  content?: RichTextInline[]
  /** The blocks nested under it, which is how a list is indented */
  children?: RichTextBlock[]
}
