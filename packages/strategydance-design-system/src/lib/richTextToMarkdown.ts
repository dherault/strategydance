import type { BlockContent, List, ListItem, Paragraph, PhrasingContent, Table, TableCell } from 'mdast'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import type {
  RichTextBlock,
  RichTextInline,
  RichTextRun,
  RichTextStyles,
  RichTextTableBlock,
  RichTextTextBlock,
} from 'strategydance-design-system/lib/richText'

type Style = keyof RichTextStyles

// The order styles nest in when two cover the same text, underline innermost, its tags against the words
const STYLE_ORDER: readonly Style[] = ['bold', 'italic', 'strike', 'underline']

type ListItemBlock = RichTextTextBlock & { type: 'bulletListItem' | 'numberedListItem' | 'checkListItem' }

/*
  What goes between two styles written in asterisks that touch, bold then italic say: an empty
  comment, which `markdownToRichText` reads as nothing. Without it, their markers make one run,
  which CommonMark can read as neither, as in `**a*b****c*`
*/
const SEPARATOR: PhrasingContent = { type: 'html', value: '<!---->' }

// A run of text, or a link, as written, and the styles still to write around it
type Piece = { styles: Style[]; nodes: PhrasingContent[] }

/*
  Rich text as Markdown, for an agent to read and write back: what `markdownToRichText` reads as
  the same blocks, GFM escaped where text would read as Markdown, so text that looks like a tag
  stays text.

  Consecutive list items of one kind are one list, a numbered item with a first number of its own
  starting another, and what is nested under an item is nested under it in Markdown. What is
  nested under any other block follows it, since Markdown indents nothing else. Code is fenced,
  with its language, and a table is a GFM table, its first row its header when it has one, and
  under an empty header row when it does not, which reads back as none. A table's columns lose
  their widths and its header column, and a line break in a cell is a space. A picture, a video
  and a link preview are a link, with the picture's caption or the page's title. Underline is
  `<u>…</u>`, and a line break inside a block a hard one
*/
function richTextToMarkdown(blocks: readonly RichTextBlock[]): string {
  const children = writeBlocks(normalizeRichText(blocks))

  if (!children.length) return ''

  return toMarkdown(
    { type: 'root', children },
    { extensions: [gfmToMarkdown()], bullet: '-', listItemIndent: 'one', fences: true },
  ).trimEnd()
}

function isListItem(block: RichTextBlock): block is ListItemBlock {
  return block.type === 'bulletListItem' || block.type === 'numberedListItem' || block.type === 'checkListItem'
}

// Whether an item goes on the list before it: a bulleted or check one after either, and a numbered one with no first number after a numbered one
function isInSameList(list: ListItemBlock[], item: ListItemBlock) {
  if (list[0].type === 'numberedListItem') return item.type === 'numberedListItem' && item.props?.start === undefined

  return item.type !== 'numberedListItem'
}

function writeBlocks(blocks: RichTextBlock[]): BlockContent[] {
  const written: BlockContent[] = []
  let list: ListItemBlock[] = []

  const writeList = () => {
    if (list.length) written.push(createList(list))

    list = []
  }

  for (const block of blocks) {
    if (isListItem(block)) {
      if (list.length && !isInSameList(list, block)) writeList()

      list.push(block)
    } else {
      writeList()
      written.push(...writeBlock(block), ...writeBlocks(block.children ?? []))
    }
  }

  writeList()

  return written
}

function createList(items: ListItemBlock[]): List {
  const isOrdered = items[0].type === 'numberedListItem'

  return {
    type: 'list',
    ordered: isOrdered,
    ...(isOrdered ? { start: items[0].props?.start ?? 1 } : {}),
    spread: false,
    children: items.map(createListItem),
  }
}

function createListItem(item: ListItemBlock): ListItem {
  return {
    type: 'listItem',
    spread: false,
    ...(item.type === 'checkListItem' ? { checked: !!item.props?.checked } : {}),
    // A check item keeps its paragraph even when empty, which its box is written before
    children: [createParagraph(item.content ?? []), ...writeBlocks(item.children ?? [])],
  }
}

function createParagraph(content: RichTextInline[]): Paragraph {
  return { type: 'paragraph', children: writeInline(content) }
}

// A paragraph holding a link alone, to an address with its words, or nothing without an address
function createLinkParagraph(url: string | undefined, text: string | undefined): BlockContent[] {
  if (!url) return []

  return [{ type: 'paragraph', children: [{ type: 'link', url, children: [{ type: 'text', value: text || url }] }] }]
}

function writeBlock(block: RichTextBlock): BlockContent[] {
  switch (block.type) {
    case 'bulletListItem':
    case 'numberedListItem':
    case 'checkListItem':
      return [createList([block as ListItemBlock])]
    case 'paragraph':
      // An empty paragraph has nothing to say in Markdown, whose blank lines say where paragraphs end
      return block.content?.length ? [createParagraph(block.content)] : []
    case 'heading':
      return [{ type: 'heading', depth: block.props?.level ?? 2, children: writeInline(block.content ?? []) }]
    case 'quote':
      return [{ type: 'blockquote', children: [createParagraph(block.content ?? [])] }]
    case 'codeBlock':
      return [{ type: 'code', lang: block.props?.language ?? null, value: block.content?.[0].text ?? '' }]
    case 'table':
      return [createTable(block)]
    case 'image':
      return createLinkParagraph(block.props?.url, block.props?.caption || block.props?.name)
    case 'videoEmbed':
      return createLinkParagraph(block.props?.url, undefined)
    case 'linkPreview':
      return createLinkParagraph(block.props?.url, block.props?.title)
  }
}

function createTable(block: RichTextTableBlock): Table {
  const { rows, headerRows } = block.content
  const width = rows[0]?.cells.length ?? 0
  const createRow = (cells: RichTextInline[][]) => ({
    type: 'tableRow' as const,
    children: cells.map((cell): TableCell => ({ type: 'tableCell', children: writeInline(withoutLineBreaks(cell)) })),
  })
  const header = headerRows ? [] : [createRow(Array.from({ length: width }, () => []))]

  return { type: 'table', children: [...header, ...rows.map(row => createRow(row.cells))] }
}

// A cell's text on one line, as a GFM table's cells are
function withoutLineBreaks(content: RichTextInline[]): RichTextInline[] {
  const flatten = (run: RichTextRun): RichTextRun => ({ ...run, text: run.text.replace(/\n/g, ' ') })

  return content.map(item => (item.type === 'link' ? { ...item, content: item.content.map(flatten) } : flatten(item)))
}

// Text, its line breaks hard ones
function writeText(text: string): PhrasingContent[] {
  return text
    .split('\n')
    .flatMap((line, index): PhrasingContent[] => [
      ...(index ? [{ type: 'break' as const }] : []),
      ...(line ? [{ type: 'text' as const, value: line }] : []),
    ])
}

function readStyles(run: RichTextRun): Style[] {
  return STYLE_ORDER.filter(style => run.styles?.[style])
}

function writeInline(content: RichTextInline[]): PhrasingContent[] {
  return wrapPieces(
    content.map(item =>
      item.type === 'link'
        ? { styles: [], nodes: [{ type: 'link', url: item.href, children: writeInline(item.content) }] }
        : { styles: readStyles(item), nodes: writeText(item.text) },
    ),
  )
}

function wrap(style: Style, children: PhrasingContent[]): PhrasingContent[] {
  if (style === 'bold') return [{ type: 'strong', children }]
  if (style === 'italic') return [{ type: 'emphasis', children }]
  if (style === 'strike') return [{ type: 'delete', children }]

  return [{ type: 'html', value: '<u>' }, ...children, { type: 'html', value: '</u>' }]
}

/*
  Pieces of text in their styles. Each style wraps as many neighbouring pieces as carry it, the one
  shared longest first, so the text never closes a style only to open it again on the next piece
*/
function wrapPieces(pieces: Piece[]): PhrasingContent[] {
  const written: PhrasingContent[] = []
  let index = 0

  while (index < pieces.length) {
    const { styles, nodes } = pieces[index]

    if (!styles.length) {
      written.push(...nodes)
      index += 1

      continue
    }

    let style = styles[0]
    let end = index

    for (const candidate of styles) {
      let candidateEnd = index

      while (candidateEnd + 1 < pieces.length && pieces[candidateEnd + 1].styles.includes(candidate)) candidateEnd += 1

      if (candidateEnd > end) {
        style = candidate
        end = candidateEnd
      }
    }

    const inner = pieces
      .slice(index, end + 1)
      .map(piece => ({ ...piece, styles: piece.styles.filter(other => other !== style) }))

    // Two styles written with the same marker, touching, would read as one run of it
    if (isAsterisked(written.at(-1)) && (style === 'bold' || style === 'italic')) written.push(SEPARATOR)

    written.push(...wrap(style, wrapPieces(inner)))
    index = end + 1
  }

  return written
}

function isAsterisked(node: PhrasingContent | undefined) {
  return node?.type === 'strong' || node?.type === 'emphasis'
}

export { richTextToMarkdown }
