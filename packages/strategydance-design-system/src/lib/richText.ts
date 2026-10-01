/*
  How rich text looks, as `RichText` draws it from BlockNote's blocks. The editor's stylesheet,
  `RichTextEditor.css`, sets BlockNote's own blocks to match, so a post reads the same while it is
  written and once it is posted.

  Preflight strips list markers, so the lists name theirs. A bulleted list's marker follows its
  depth, as BlockNote draws it, and a check item's box is drawn rather than being the browser's, so
  a card's picture copies it
*/
const richTextClassName = 'text-[15px] leading-[1.6] wrap-anywhere text-pretty text-secondary [&>:last-child]:mb-0'

const richTextClasses = {
  paragraph: 'mb-2',
  heading: 'mt-1 mb-1.5 font-display text-xl/[1.25] font-normal tracking-normal text-secondary',
  quote: 'mb-2 border-l-2 border-neutral-300 pl-3 text-neutral-600',
  bulletedList: 'mb-2 pl-[22px]',
  bulletMarkers: ['list-disc', 'list-[circle]', 'list-[square]'],
  numberedList: 'mb-2 list-decimal pl-[22px]',
  checkList: 'mb-2 list-none',
  // A nested list sits flush under its item
  listItem: 'my-0.5 [&>ol]:mb-0 [&>ul]:mb-0',
  checkLabel: 'flex items-start gap-2',
  checkBox:
    'mt-[0.3em] flex size-[0.95em] shrink-0 items-center justify-center rounded-[3px] border border-neutral-400 bg-white text-white [&_svg]:size-[0.75em] [&_svg]:stroke-3',
  checkBoxChecked: 'border-primary bg-primary',
  checkedText: 'line-through opacity-60',
  // What is nested under a block that is not a list item, and under a check item, under its text
  nested: 'pl-6 [&>:last-child]:mb-0',
  link: 'text-primary underline underline-offset-2 hover:text-primary-700',
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: '[text-decoration-line:underline_line-through]',
  },
}

export const RICH_TEXT_CLASS_NAME = richTextClassName
export const RICH_TEXT_CLASSES = richTextClasses

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
