import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { normalizeRichText } from 'strategydance-design-system/lib/normalizeRichText'
import {
  type RichTextBlock,
  type RichTextInline,
  type RichTextRun,
  type RichTextStyles,
  type RichTextTableContent,
  type RichTextTextBlock,
  getRichTextCodeLanguage,
} from 'strategydance-design-system/lib/richText'

// As deep as `normalizeRichText` keeps, past which a hostile value nesting thousands of levels is dropped
const MAX_DEPTH = 32

// The one tag read as what it says, underline, which Markdown has no syntax for
const UNDERLINE_OPEN = /^<u\s*>$/i
const UNDERLINE_CLOSE = /^<\/u\s*>$/i

// The empty comment `richTextToMarkdown` writes between two styles whose markers would otherwise touch
const SEPARATOR = '<!---->'

// A GFM task list item's box, at the start of its text
const TASK_BOX = /^\[([ xX])\](?:[ \t]+|$)/

const STYLE_TOKENS: Record<string, keyof RichTextStyles> = { strong: 'bold', em: 'italic', s: 'strike' }

/*
  markdown-it rather than micromark, which `react-markdown` draws the thread with: micromark takes
  time growing with the square of what it reads, or worse, on text an agent could be told to write,
  lists or brackets by the thousand say, minutes for the length a document may have, where
  markdown-it stays near a second. HTML is read as tokens, which are only ever written as text, and
  a web address alone is a link, but not a host name without one, as GFM has it
*/
const markdownIt = new MarkdownIt({ html: true, linkify: true })

markdownIt.linkify.set({ fuzzyLink: false })

// A token and those it opens, the tree markdown-it lays flat
type Node = { token: Token; children: Node[] }

/*
  Markdown, as an agent writes it, as rich text as it is stored: GFM, a single `~` striking
  nothing, kept to the blocks and styles rich text has.

  A paragraph, a heading, a quote, a list, a check list, code and a table are themselves. A heading
  past the third level reads as the third, as `normalizeRichText` has it, and a quote holds its
  paragraphs and headings as quotes, its other blocks as themselves. A list item's first paragraph
  is its text and the rest of it is nested under it. A table's header row is its first row, unless
  every cell of it is empty, which is how a table without one is written. An HTML block is its
  text, and a rule is nothing.

  Bold, italic and strikethrough are themselves, and so is underline, written as `<u>…</u>` within
  one paragraph or one other run of text, the one tag read as what it says, and the empty comment
  `richTextToMarkdown` separates two styles with is nothing. Any other tag, and one `<u>` or `</u>`
  without the other, stays as written, so nothing is ever HTML. A single line break breaks the
  line, as the `Markdown` component draws it. A link is kept to a web or mail address, and one to
  anything else stays as written. A picture is a link to its address with its alternative text, so
  nothing is loaded from anywhere, and inline code is its text.

  Never cut to a length: what holds a text to one is whatever stores it
*/
function markdownToRichText(markdown: string): RichTextBlock[] {
  return joinBlocks(normalizeRichText(readBlocks(buildTree(markdownIt.parse(markdown, {})), 0)))
}

// The tokens as a tree, each opening token holding what comes before its closing one
function buildTree(tokens: Token[]): Node[] {
  const root: Node[] = []
  const stack: Node[][] = [root]

  for (const token of tokens) {
    if (token.nesting === -1) {
      stack.pop()

      continue
    }

    const node: Node = { token, children: [] }

    stack.at(-1)?.push(node)

    if (token.nesting === 1) stack.push(node.children)
  }

  return root
}

function readBlocks(nodes: Node[], depth: number): RichTextBlock[] {
  if (depth >= MAX_DEPTH) return []

  return nodes.flatMap(node => readBlock(node, depth))
}

// The inline content of a paragraph, a heading or a cell, which markdown-it keeps in one inline token
function readContent(node: Node | undefined): RichTextInline[] {
  const inline = node?.children.find(child => child.token.type === 'inline')

  return inline ? readInline(inline.token.children ?? []) : []
}

function readBlock({ token, children }: Node, depth: number): RichTextBlock[] {
  switch (token.type) {
    case 'paragraph_open':
      return [{ type: 'paragraph', content: readContent({ token, children }) }]
    case 'heading_open':
      return [{ type: 'heading', ...readHeadingProps(token.tag), content: readContent({ token, children }) }]
    case 'blockquote_open':
      return readBlocks(children, depth + 1).map(block =>
        block.type === 'paragraph' || block.type === 'heading' ? { type: 'quote', content: block.content } : block,
      )
    case 'bullet_list_open':
    case 'ordered_list_open':
      return children.map((item, index) => readListItem(token, item, index, depth))
    case 'fence':
    case 'code_block': {
      const language = getRichTextCodeLanguage(token.info.split(/\s/)[0])
      const text = token.content.replace(/\n$/, '')

      return [
        {
          type: 'codeBlock',
          ...(language === 'text' ? {} : { props: { language } }),
          ...(text ? { content: [{ type: 'text', text }] } : {}),
        },
      ]
    }
    case 'table_open':
      return [readTable(children)]
    case 'html_block':
      return [{ type: 'paragraph', content: [{ type: 'text', text: token.content.replace(/\n$/, '') }] }]
    default:
      return []
  }
}

// The second level is the default, and one past the third reads as the third
function readHeadingProps(tag: string): Pick<RichTextTextBlock, 'props'> {
  if (tag === 'h1') return { props: { level: 1 } }
  if (tag !== 'h2') return { props: { level: 3 } }

  return {}
}

/*
  A bulleted, numbered or check item: its first paragraph its text, the rest of it nested under it.
  A box at the start of the text, `[ ]` or `[x]`, makes it a check item, as GFM has it
*/
function readListItem(list: Token, item: Node, index: number, depth: number): RichTextTextBlock {
  const [first, ...rest] = item.children
  const hasText = first?.token.type === 'paragraph_open' || first?.token.type === 'heading_open'
  const content = hasText ? readContent(first) : []
  const children = readBlocks(hasText ? rest : item.children, depth + 1)
  const nested = children.length ? { children } : {}
  const [head] = content
  const box = head?.type === 'text' && !head.styles ? TASK_BOX.exec(head.text) : null

  if (box && head?.type === 'text') {
    const text = head.text.slice(box[0].length)

    return {
      type: 'checkListItem',
      ...(box[1] === ' ' ? {} : { props: { checked: true } }),
      content: text ? [{ ...head, text }, ...content.slice(1)] : content.slice(1),
      ...nested,
    }
  }

  if (list.type === 'bullet_list_open') return { type: 'bulletListItem', content, ...nested }

  // A list's first number is its first item's, which BlockNote numbers the items after it from
  const start = Number(list.attrGet('start') ?? 1)

  return { type: 'numberedListItem', ...(index === 0 && start !== 1 ? { props: { start } } : {}), content, ...nested }
}

// Rows of cells of text, its first row its header unless every cell of that row is empty
function readTable(children: Node[]): RichTextBlock {
  // The rows of the head and of the body, in order
  const rows = children
    .flatMap(section => section.children)
    .map(row => ({ cells: row.children.map(cell => readContent(cell)) }))
  const [header, ...body] = rows
  const hasHeader = !!header?.cells.some(cell => cell.length)
  const content: RichTextTableContent = {
    type: 'tableContent',
    ...(hasHeader ? { headerRows: 1 } : {}),
    rows: hasHeader ? rows : body,
  }

  return { type: 'table', content }
}

// Runs of text and links
function readInline(tokens: Token[]): RichTextInline[] {
  const inline: RichTextInline[] = []

  readPhrasing(buildTree(tokens), {}, inline, 0, false)

  return inline
}

function createRun(text: string, styles: RichTextStyles): RichTextRun {
  return { type: 'text', text, ...(Object.keys(styles).length ? { styles } : {}) }
}

/*
  The text of some inline nodes, in the styles around them. Each `<u>` is paired with the first
  `</u>` after it among the same nodes, as nested pairs are, and is underline only then
*/
function readPhrasing(
  nodes: Node[],
  styles: RichTextStyles,
  inline: RichTextInline[],
  depth: number,
  isInLink: boolean,
) {
  if (depth >= MAX_DEPTH) return

  const paired = pairUnderlines(nodes)
  let underlines = 0

  const getStyles = (): RichTextStyles => (underlines ? { ...styles, underline: true } : styles)

  // A link's runs, or its runs alone inside another link, which only a picture's alternative text can put there
  const pushLink = (href: string | null, read: (runs: RichTextInline[]) => void) => {
    const runs: RichTextInline[] = []

    read(runs)

    const content = runs.filter(run => run.type === 'text')

    if (href && !isInLink) inline.push({ type: 'link', href, content })
    else inline.push(...content)
  }

  nodes.forEach(({ token, children }, index) => {
    switch (token.type) {
      case 'text':
      case 'text_special':
      case 'code_inline':
        if (token.content) inline.push(createRun(token.content, getStyles()))

        return
      case 'softbreak':
      case 'hardbreak':
        inline.push(createRun('\n', getStyles()))

        return
      case 'strong_open':
      case 'em_open':
      case 's_open':
        readPhrasing(children, { ...getStyles(), [STYLE_TOKENS[token.tag]]: true }, inline, depth + 1, isInLink)

        return
      case 'html_inline':
        if (token.content === SEPARATOR) return
        if (paired.has(index)) underlines += UNDERLINE_OPEN.test(token.content) ? 1 : -1
        else inline.push(createRun(token.content, getStyles()))

        return
      case 'link_open':
        pushLink(token.attrGet('href'), runs => readPhrasing(children, getStyles(), runs, depth + 1, true))

        return
      case 'image': {
        const href = token.attrGet('src')
        const text = token.content || href

        pushLink(href, runs => {
          if (text) runs.push(createRun(text, getStyles()))
        })

        return
      }
      default:
        return
    }
  })
}

// The indexes of the `<u>` and `</u>` among some nodes that close each other
function pairUnderlines(nodes: Node[]) {
  const paired = new Set<number>()
  const open: number[] = []

  nodes.forEach(({ token }, index) => {
    if (token.type !== 'html_inline') return

    if (UNDERLINE_OPEN.test(token.content)) {
      open.push(index)
    } else if (UNDERLINE_CLOSE.test(token.content) && open.length) {
      paired.add(open.pop() as number)
      paired.add(index)
    }
  })

  return paired
}

function isSameStyles(a: RichTextStyles | undefined, b: RichTextStyles | undefined) {
  const keys = (styles: RichTextStyles | undefined) =>
    Object.keys(styles ?? {})
      .sort()
      .join()

  return keys(a) === keys(b)
}

/*
  Each block with neighbouring runs of the same styles as one, once `normalizeRichText` has turned
  a link it does not keep into its runs
*/
function joinBlocks(blocks: RichTextBlock[]): RichTextBlock[] {
  return blocks.map(block => {
    const children = block.children ? { children: joinBlocks(block.children) } : {}

    if (block.type === 'table') {
      const rows = block.content.rows.map(row => ({ cells: row.cells.map(cell => joinRuns(cell)) }))

      return { ...block, content: { ...block.content, rows }, ...children }
    }

    if (block.type === 'codeBlock' || !('content' in block) || !block.content) return { ...block, ...children }

    return { ...block, content: joinRuns(block.content), ...children }
  })
}

// Neighbouring runs of the same styles as one, in a link as much as outside one
function joinRuns<T extends RichTextInline>(inline: T[]): T[] {
  return inline.reduce<T[]>((joined, item) => {
    const last = joined.at(-1)
    const next = item.type === 'link' ? { ...item, content: joinRuns(item.content) } : item

    if (last?.type === 'text' && next.type === 'text' && isSameStyles(last.styles, next.styles)) {
      joined[joined.length - 1] = { ...last, text: last.text + next.text }
    } else {
      joined.push(next)
    }

    return joined
  }, [])
}

export { markdownToRichText }
