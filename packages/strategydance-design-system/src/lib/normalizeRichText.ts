import type {
  RichTextBlock,
  RichTextBlockType,
  RichTextInline,
  RichTextRun,
  RichTextStyles,
} from 'strategydance-design-system/lib/richText'

// Deeper than any list anybody indents by hand, and shallow enough that a hostile value nesting
// thousands of levels cannot exhaust the stack
const MAX_DEPTH = 32

const ALL_BLOCK_TYPES: readonly RichTextBlockType[] = [
  'paragraph',
  'heading',
  'quote',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
]

const STYLES = ['bold', 'italic', 'underline', 'strike'] as const

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

type Options = {
  /** The blocks to keep, all six unless it says fewer. Any other block holding text becomes a paragraph */
  blockTypes?: readonly RichTextBlockType[]
}

type UnknownRecord = Record<string, unknown>

/*
  Rich text in the one form it is stored, drawn and loaded in, from whatever claims to be
  BlockNote's blocks: the editor's document as it is typed, or a stored value as it is read.

  A stored value is somebody else's, since a feed shows everybody's posts, and it is JSON a client
  wrote, so nothing in it is trusted. A block keeps its type when it is one the options allow, and
  becomes a paragraph otherwise when it holds text. One holding none, such as a table or an image,
  gives way to its children. Ids, colors, alignment and every other prop go, but a heading's level,
  a numbered list's first number and a check item's tick. Text keeps four styles. A link keeps its address when it is
  a web or mail one, written as the URL parser writes it, and is its text otherwise.

  Keys come in one order and empty ones are left out, and the empty paragraphs a document ends on
  are dropped, so the same document always serializes to the same string. Anything that is not an
  array, Lexical's editor state among them, reads as nothing
*/
function normalizeRichText(value: unknown, { blockTypes = ALL_BLOCK_TYPES }: Options = {}): RichTextBlock[] {
  if (!Array.isArray(value)) return []

  const blocks = normalizeBlocks(value, new Set(blockTypes), 0)
  const end = blocks.findLastIndex(block => !isEmptyParagraph(block))

  return blocks.slice(0, end + 1)
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeBlocks(values: unknown[], blockTypes: ReadonlySet<string>, depth: number): RichTextBlock[] {
  if (depth >= MAX_DEPTH) return []

  return values.flatMap(value => (isRecord(value) ? normalizeBlock(value, blockTypes, depth) : []))
}

function normalizeBlock(value: UnknownRecord, blockTypes: ReadonlySet<string>, depth: number): RichTextBlock[] {
  const children = Array.isArray(value.children) ? normalizeBlocks(value.children, blockTypes, depth + 1) : []
  const isKnown = typeof value.type === 'string' && blockTypes.has(value.type)
  const hasContent = typeof value.content === 'string' || Array.isArray(value.content)

  if (!isKnown && !hasContent) return children

  const type = isKnown ? (value.type as RichTextBlockType) : 'paragraph'
  const props = normalizeProps(type, value.props)
  const content = normalizeInline(value.content)

  return [
    {
      type,
      ...(props ? { props } : {}),
      ...(content.length ? { content } : {}),
      ...(children.length ? { children } : {}),
    },
  ]
}

function normalizeProps(type: RichTextBlockType, props: unknown): RichTextBlock['props'] {
  if (!isRecord(props)) return undefined

  // The second level is the default and goes unsaid, and one past the third reads as the third
  if (type === 'heading' && Number.isSafeInteger(props.level)) {
    const level = Math.min(props.level as number, 3)

    return level === 1 || level === 3 ? { level } : undefined
  }

  // Any whole number but the 1 a list starts at anyway, which BlockNote leaves out too, and 0,
  // which BlockNote's editor numbers from 1, as it does a list with no start
  if (type === 'numberedListItem' && Number.isSafeInteger(props.start) && props.start !== 1 && props.start !== 0) {
    return { start: props.start as number }
  }

  if (type === 'checkListItem' && props.checked === true) return { checked: true }

  return undefined
}

function normalizeInline(content: unknown): RichTextInline[] {
  if (!Array.isArray(content)) return normalizeRuns(content)

  return content.flatMap((item): RichTextInline[] => {
    if (!isRecord(item) || item.type !== 'link') return normalizeRuns([item])

    const runs = normalizeRuns(item.content)
    const href = normalizeHref(item.href)

    if (!runs.length) return []

    return href ? [{ type: 'link', href, content: runs }] : runs
  })
}

/*
  Text, a plain string being text without styles. An inline element of another kind, or a link
  where a link cannot be, reads as its text
*/
function normalizeRuns(content: unknown, depth = 0): RichTextRun[] {
  if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : []
  if (!Array.isArray(content) || depth >= MAX_DEPTH) return []

  return content.flatMap((item): RichTextRun[] => {
    if (typeof item === 'string') return normalizeRuns(item)
    if (!isRecord(item)) return []
    if (item.type !== 'text') return normalizeRuns(item.content, depth + 1)
    if (typeof item.text !== 'string' || !item.text) return []

    const styles = normalizeStyles(item.styles)

    return [{ type: 'text', text: item.text, ...(styles ? { styles } : {}) }]
  })
}

function normalizeStyles(styles: unknown): RichTextStyles | undefined {
  if (!isRecord(styles)) return undefined

  const kept: RichTextStyles = {}

  for (const style of STYLES) if (styles[style] === true) kept[style] = true

  return Object.keys(kept).length ? kept : undefined
}

function normalizeHref(href: unknown) {
  if (typeof href !== 'string') return null

  try {
    const url = new URL(href)

    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function isEmptyParagraph(block: RichTextBlock) {
  return block.type === 'paragraph' && !block.content && !block.children
}

export { normalizeRichText }
