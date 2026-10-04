import { getRichTextInlineText } from 'strategydance-design-system/lib/getRichTextText'
import {
  type RichTextBlock,
  type RichTextBlockType,
  type RichTextCodeBlock,
  type RichTextImageBlock,
  type RichTextInline,
  type RichTextRun,
  type RichTextStyles,
  type RichTextTableBlock,
  type RichTextTableContent,
  type RichTextTextBlock,
  getRichTextCodeLanguage,
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
  'codeBlock',
  'table',
  'image',
]

// More than a table written by hand ever has, and few enough that a hostile one stays small
const MAX_TABLE_ROWS = 200
const MAX_TABLE_COLUMNS = 25

// The narrowest and widest a resized column may be, BlockNote's narrowest and a wide screen's width
const MIN_COLUMN_WIDTH = 35
const MAX_COLUMN_WIDTH = 2000

const STYLES = ['bold', 'italic', 'underline', 'strike'] as const

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

// What a picture may be loaded from: the web, and the Storage emulator, which development serves over http
const MEDIA_PROTOCOLS = new Set(['http:', 'https:'])

// Longer than any caption or alternative text written by hand
const MAX_MEDIA_TEXT_LENGTH = 1000

type Options = {
  /** The blocks to keep, every one unless it says fewer. Any other block holding text becomes a paragraph */
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
  a numbered list's first number, a check item's tick and a code block's language. Text keeps four
  styles, and code none. A table keeps its cells' text, laid out on its grid with merged cells
  split, and the widths of its columns, and whether its first row and column are headers. A
  picture keeps its web address, its alternative text, its caption and the width it was resized
  to. A link keeps its address when it is a web or mail one, written as the URL
  parser writes it, and is its text otherwise.

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
  const block =
    type === 'codeBlock'
      ? normalizeCodeBlock(value)
      : type === 'table'
        ? normalizeTable(value)
        : type === 'image'
          ? normalizeImage(value)
          : normalizeTextBlock(type, value)

  if (!block) return children

  return [{ ...block, ...(children.length ? { children } : {}) }]
}

function normalizeTextBlock(type: RichTextTextBlock['type'], value: UnknownRecord): RichTextTextBlock {
  const props = normalizeTextProps(type, value.props)
  const content = normalizeInline(value.content)

  return { type, ...(props ? { props } : {}), ...(content.length ? { content } : {}) }
}

// Its text in one run without styles, whatever it was written in, and its language unless that is plain text
function normalizeCodeBlock(value: UnknownRecord): RichTextCodeBlock {
  const language = getRichTextCodeLanguage(isRecord(value.props) ? value.props.language : undefined)
  const text = getRichTextInlineText(normalizeInline(value.content))

  return {
    type: 'codeBlock',
    ...(language === 'text' ? {} : { props: { language } }),
    ...(text ? { content: [{ type: 'text', text }] } : {}),
  }
}

/*
  A table as rows of cells of text, every row as wide as the widest. BlockNote hands a cell over as
  a cell with props, and takes it back as its text alone, which is how it is stored. A merged cell,
  which a paste can bring in, is split, its text in its first cell and the others empty, so every
  cell keeps its column. Its first row and column are headers when it says they are: BlockNote
  counts the columns of a table of one header row as header columns too, so those are not. A table
  without a cell is nothing
*/
function normalizeTable(value: UnknownRecord): RichTextTableBlock | null {
  const content = isRecord(value.content) ? value.content : {}
  const rows = readRows(Array.isArray(content.rows) ? content.rows.slice(0, MAX_TABLE_ROWS) : [])
  const width = Math.min(Math.max(0, ...rows.map(cells => cells.length)), MAX_TABLE_COLUMNS)

  if (!width) return null

  const hasHeaderRow = Number.isSafeInteger(content.headerRows) && (content.headerRows as number) >= 1
  const hasHeaderColumn =
    Number.isSafeInteger(content.headerCols)
    && (content.headerCols as number) >= 1
    && !(hasHeaderRow && rows.length === 1)
  const columnWidths = normalizeColumnWidths(content.columnWidths, width)
  const table: RichTextTableContent = {
    type: 'tableContent',
    ...(hasHeaderRow ? { headerRows: 1 } : {}),
    ...(hasHeaderColumn ? { headerCols: 1 } : {}),
    ...(columnWidths ? { columnWidths } : {}),
    rows: rows.map(cells => ({ cells: Array.from({ length: width }, (_, index) => cells[index] ?? []) })),
  }

  return { type: 'table', content: table }
}

// Each row's cells on the table's grid, a cell spanning several columns or rows leaving empty cells in them
function readRows(rows: unknown[]) {
  // How many rows below each column is still covered by a cell spanning rows
  const covered: number[] = []

  return rows.map(row => {
    const cells: RichTextInline[][] = []
    const skipCovered = () => {
      while (covered[cells.length] > 0) {
        covered[cells.length] -= 1
        cells.push([])
      }
    }

    for (const cell of isRecord(row) && Array.isArray(row.cells) ? row.cells : []) {
      skipCovered()

      const { content, colspan, rowspan } = readCell(cell)

      for (let index = 0; index < colspan && cells.length < MAX_TABLE_COLUMNS; index++) {
        covered[cells.length] = rowspan - 1
        cells.push(index ? [] : content)
      }
    }

    skipCovered()

    return cells
  })
}

// A cell's text and how many columns and rows it spans, from a cell with props, its content or its text
function readCell(cell: unknown) {
  if (!isRecord(cell)) return { content: normalizeInline(cell), colspan: 1, rowspan: 1 }

  const props = isRecord(cell.props) ? cell.props : {}

  return {
    content: normalizeInline(cell.content),
    colspan: readSpan(props.colspan, MAX_TABLE_COLUMNS),
    rowspan: readSpan(props.rowspan, MAX_TABLE_ROWS),
  }
}

function readSpan(span: unknown, max: number) {
  return Number.isSafeInteger(span) && (span as number) > 1 ? Math.min(span as number, max) : 1
}

// The width of each of a table's columns, whole and within bounds, or nothing when none has one
function normalizeColumnWidths(widths: unknown, count: number) {
  if (!Array.isArray(widths)) return null

  const normalized = Array.from({ length: count }, (_, index) => {
    const width: unknown = widths[index]

    return typeof width === 'number' && Number.isFinite(width)
      ? Math.min(Math.max(Math.round(width), MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH)
      : null
  })

  return normalized.some(width => width !== null) ? normalized : null
}

// A picture as it is drawn. One with no web address keeps none, and is the place one is about to go
function normalizeImage(value: UnknownRecord): RichTextImageBlock {
  const props = isRecord(value.props) ? value.props : {}
  const url = normalizeUrl(props.url, MEDIA_PROTOCOLS)
  const name = normalizeMediaText(props.name)
  const caption = normalizeMediaText(props.caption)
  const previewWidth =
    typeof props.previewWidth === 'number' && Number.isFinite(props.previewWidth) && props.previewWidth >= 1
      ? Math.min(Math.round(props.previewWidth), MAX_COLUMN_WIDTH)
      : null
  const normalized = {
    ...(url ? { url } : {}),
    ...(name ? { name } : {}),
    ...(caption ? { caption } : {}),
    ...(previewWidth ? { previewWidth } : {}),
  }

  return { type: 'image', ...(Object.keys(normalized).length ? { props: normalized } : {}) }
}

function normalizeMediaText(text: unknown) {
  return typeof text === 'string' ? text.slice(0, MAX_MEDIA_TEXT_LENGTH) : ''
}

function normalizeTextProps(type: RichTextTextBlock['type'], props: unknown): RichTextTextBlock['props'] {
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
  return normalizeUrl(href, SAFE_PROTOCOLS)
}

// An address in one of the protocols, as the URL parser writes it, or null
function normalizeUrl(value: unknown, protocols: ReadonlySet<string>) {
  if (typeof value !== 'string') return null

  try {
    const url = new URL(value)

    return protocols.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function isEmptyParagraph(block: RichTextBlock) {
  return block.type === 'paragraph' && !block.content && !block.children
}

export { normalizeRichText }
