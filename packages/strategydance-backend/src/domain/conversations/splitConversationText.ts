import MarkdownIt, { type Token } from 'markdown-it'
import { MAX_CONVERSATION_MESSAGE_LENGTH } from 'strategydance-core'

// A piece of a text, by its offsets, and what it is drawn with around them, when a cut runs through
// a fenced code block or a table: the fence or the table's head before, the fence closed after
export type ConversationTextPiece = {
  start: number
  end: number
  before?: string
  after?: string
}

// A top-level Markdown block, by its offsets
type MarkdownBlock = {
  type: string
  start: number
  end: number
}

// The longest head a piece carries over, so a table whose head alone is huge is cut as it is
const MAX_CARRIED_HEAD = 2000

// How far past the bound the grapheme segmentation reads, so a cluster across it is seen whole
const GRAPHEME_LOOKAHEAD = 64

/*
  Reads where a reply's top-level blocks start and end, and nothing inside them: inline parsing,
  where micromark takes minutes on closing brackets by the thousand, never runs, and markdown-it's
  block parsing takes list markers by the thousand in time growing with their number, where
  micromark's grows with its square. A reply is Claude's, but text it read on the web can tell it
  what to write, and a subagent reads the web with nobody watching. HTML blocks are read as blocks,
  as the thread's Markdown reads them, which then draws them as text
*/
const markdownIt = new MarkdownIt({ html: true })

markdownIt.core.ruler.enableOnly(['normalize', 'block'])

/*
  Splits a reply's text into the pieces the thread draws, each at most 20000 characters, the bound
  every message keeps, which one turn may pass many times over. A piece ends at the last boundary
  before the bound, trying in order:

  1. the end of one of the model's text blocks (`blockEnds`)
  2. the start of a top-level Markdown block, as markdown-it reads them, where the thread's
     Markdown reads them alike, so a list or a table is never cut when it need not be
  3. a line break, for a single Markdown block past the bound
  4. a space, for a single line past it
  5. a grapheme boundary (`Intl.Segmenter`), so a piece never splits a character or a cluster

  Each piece is drawn as Markdown of its own, so one cut inside a top-level fenced code block
  closes the fence after it and opens it again before the next, and one inside a table repeats the
  table's head before the next, every piece within the bound with them. The pieces' offsets follow
  each other, so they rejoin into the text
*/
function splitConversationText(
  text: string,
  blockEnds: number[],
  maxLength = MAX_CONVERSATION_MESSAGE_LENGTH,
): ConversationTextPiece[] {
  if (text.length <= maxLength) return [{ start: 0, end: text.length }]

  const blocks = readMarkdownBlocks(text)
  const markdownStarts = blocks.flatMap(({ start }) => (start ? [start] : []))
  const pieces: ConversationTextPiece[] = []
  let start = 0
  let before = ''

  while (before.length + text.length - start > maxLength) {
    const piece = cutPiece({ text, blockEnds, blocks, markdownStarts, start, before, maxLength })

    pieces.push(piece)
    before = readOpening(text, blocks, piece.end)
    start = piece.end
  }

  pieces.push({ start, end: text.length, ...(before ? { before } : {}) })

  return pieces
}

type CutPieceInput = {
  text: string
  blockEnds: number[]
  blocks: MarkdownBlock[]
  markdownStarts: number[]
  start: number
  before: string
  maxLength: number
}

// The next piece from `start`, cut again a little earlier while what the cut adds takes it past the
// bound
function cutPiece({ text, blockEnds, blocks, markdownStarts, start, before, maxLength }: CutPieceInput) {
  let budget = maxLength - before.length

  for (;;) {
    const limit = start + Math.max(budget, 1)
    const end = moveOffClosingFence(
      text,
      blocks,
      start,
      findLastWithin(blockEnds, start, limit)
        ?? findLastWithin(markdownStarts, start, limit)
        ?? findLastAfter(text, '\n', start, limit)
        ?? findLastAfter(text, ' ', start, limit)
        ?? findLastGraphemeBoundary(text, start, limit),
    )
    const after = readClosingFence(text, blocks, end)
    const overflow = before.length + end - start + after.length - maxLength

    if (overflow <= 0 || budget <= 1) {
      return { start, end, ...(before ? { before } : {}), ...(after ? { after } : {}) }
    }

    budget -= overflow
  }
}

/*
  The top-level blocks, each from the start of its first line to the end of its last line holding
  anything, since markdown-it counts the blank lines after a list as the list's, but a fence's,
  which holds its blank lines to its closing line, or to the text's end when it has none, as the
  thread's Markdown reads it. Its lines are the text's, a CRLF or a lone CR ending one as a newline
  does, which its normalization keeps
*/
export function readMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = readLines(text)

  return markdownIt.parse(text, {}).flatMap(token => {
    if (token.level !== 0 || token.nesting === -1 || !token.map) return []

    const [startLine, endLine] = token.map
    let lastLine = Math.min(endLine, lines.length) - 1

    while (
      token.type !== 'fence'
      && lastLine > startLine
      && !text.slice(lines[lastLine]?.start, lines[lastLine]?.end).trim()
    ) {
      lastLine--
    }

    const start = lines[startLine]?.start
    const last = lines[lastLine]
    // A fence never closed runs to the text's end, its last line break included
    const end =
      token.type === 'fence'
      && last
      && (lastLine === startLine || !isClosingFence(text.slice(last.start, last.end), token.markup))
        ? text.length
        : last?.end

    return start === undefined || end === undefined ? [] : [{ type: readBlockType(token), start, end }]
  })
}

// Whether a line closes a fence opened with `markup`: as many of its characters or more, and nothing else
function isClosingFence(line: string, markup: string) {
  const closing = /^ {0,3}(`+|~+)[ \t]*$/.exec(line)?.[1]

  return Boolean(closing && closing[0] === markup[0] && closing.length >= markup.length)
}

// Where each line of a text starts and ends, its line break left out
function readLines(text: string) {
  const lines: { start: number; end: number }[] = []
  const breaks = /\r\n|\r|\n/g
  let start = 0

  for (const { index, 0: lineBreak } of text.matchAll(breaks)) {
    lines.push({ start, end: index })
    start = index + lineBreak.length
  }

  lines.push({ start, end: text.length })

  return lines
}

// A block's kind, as the cuts read it: a code block, fenced or indented, a table, or anything else
function readBlockType(token: Token) {
  if (token.type === 'fence' || token.type === 'code_block') return 'code'

  return token.type.replace(/_open$/, '')
}

// The top-level block a cut runs through, if any
function findCutBlock(blocks: MarkdownBlock[], offset: number) {
  return blocks.find(({ start, end }) => start < offset && offset < end)
}

// A fenced code block's opening line, its fence, and where its closing line starts, if it has one
function readFence(text: string, block: MarkdownBlock) {
  if (block.type !== 'code') return null

  const openingEnd = text.indexOf('\n', block.start) + 1
  const fence = /^ {0,3}(`{3,}|~{3,})/.exec(text.slice(block.start, openingEnd))?.[1]

  if (!openingEnd || openingEnd > block.end || !fence) return null

  const closingStart = text.lastIndexOf('\n', block.end - 1) + 1
  const closing = text.slice(closingStart, block.end).trim()
  const isClosed =
    closingStart >= openingEnd && closing.length >= fence.length && [...closing].every(char => char === fence[0])

  return {
    opening: text.slice(block.start, openingEnd),
    fence,
    openingEnd,
    closingStart: isClosed ? closingStart : null,
  }
}

// A cut right before a fence's closing line would leave the next piece an empty block: it goes a
// line earlier when there is one
function moveOffClosingFence(text: string, blocks: MarkdownBlock[], start: number, end: number) {
  const block = findCutBlock(blocks, end)
  const fence = block && readFence(text, block)

  if (!fence || fence.closingStart === null || end < fence.closingStart) return end

  const earlier = text.lastIndexOf('\n', fence.closingStart - 2) + 1

  return earlier > Math.max(start, fence.openingEnd) ? earlier : end
}

// What closes a fenced code block a cut runs through, after the piece
function readClosingFence(text: string, blocks: MarkdownBlock[], end: number) {
  const block = findCutBlock(blocks, end)
  const fence = block && readFence(text, block)

  if (!fence || end < fence.openingEnd) return ''

  return (text[end - 1] === '\n' ? '' : '\n') + fence.fence
}

// What opens the next piece again when a cut runs through a fenced code block or past a table's head
function readOpening(text: string, blocks: MarkdownBlock[], end: number) {
  const block = findCutBlock(blocks, end)

  if (!block) return ''

  const fence = readFence(text, block)

  if (fence) return end >= fence.openingEnd ? fence.opening : ''
  if (block.type !== 'table') return ''

  const headEnd = text.indexOf('\n', text.indexOf('\n', block.start) + 1) + 1
  const head = text.slice(block.start, headEnd)

  return headEnd > 0 && end >= headEnd && head.length <= MAX_CARRIED_HEAD ? head : ''
}

// The last boundary after `start`, at `limit` at most
function findLastWithin(boundaries: number[], start: number, limit: number) {
  let last: number | null = null

  for (const boundary of boundaries) {
    if (boundary > start && boundary <= limit && (last === null || boundary > last)) last = boundary
  }

  return last
}

// Just after the last `character` before `limit`, past `start`
function findLastAfter(text: string, character: string, start: number, limit: number) {
  const index = text.lastIndexOf(character, limit - 1)

  return index >= start && index + 1 > start ? index + 1 : null
}

// The last grapheme boundary past `start`, at `limit` at most, or `limit` for a cluster past the
// bound by itself, which no message holds
function findLastGraphemeBoundary(text: string, start: number, limit: number) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  let last = limit

  for (const { index } of segmenter.segment(text.slice(start, limit + GRAPHEME_LOOKAHEAD))) {
    const boundary = start + index

    if (boundary > limit) break
    if (boundary > start) last = boundary
  }

  return last
}

export default splitConversationText
