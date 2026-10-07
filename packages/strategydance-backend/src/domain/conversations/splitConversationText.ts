import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { MAX_CONVERSATION_MESSAGE_LENGTH } from 'strategydance-core'

// A piece of a text, by its offsets
export type ConversationTextPiece = {
  start: number
  end: number
}

// How far past the bound the grapheme segmentation reads, so a cluster across it is seen whole
const GRAPHEME_LOOKAHEAD = 64

/*
  Splits a reply's text into the pieces the thread draws, each at most 20000 characters, the bound
  every message keeps, which one turn may pass many times over. A piece ends at the last boundary
  before the bound, trying in order:

  1. the end of one of the model's text blocks (`blockEnds`)
  2. the start of a top-level Markdown block, as the thread's Markdown reads them (GFM, no single
     tilde), so a list or a table is never cut when it need not be
  3. a line break, for a single Markdown block past the bound
  4. a space, for a single line past it
  5. a grapheme boundary (`Intl.Segmenter`), so a piece never splits a character or a cluster

  The pieces follow each other, so they rejoin into the text
*/
function splitConversationText(
  text: string,
  blockEnds: number[],
  maxLength = MAX_CONVERSATION_MESSAGE_LENGTH,
): ConversationTextPiece[] {
  if (text.length <= maxLength) return [{ start: 0, end: text.length }]

  const markdownStarts = findMarkdownBlockStarts(text)
  const pieces: ConversationTextPiece[] = []
  let start = 0

  while (text.length - start > maxLength) {
    const limit = start + maxLength
    const end =
      findLastWithin(blockEnds, start, limit)
      ?? findLastWithin(markdownStarts, start, limit)
      ?? findLastAfter(text, '\n', start, limit)
      ?? findLastAfter(text, ' ', start, limit)
      ?? findLastGraphemeBoundary(text, start, limit)

    pieces.push({ start, end })
    start = end
  }

  pieces.push({ start, end: text.length })

  return pieces
}

function findMarkdownBlockStarts(text: string) {
  const tree = fromMarkdown(text, {
    extensions: [gfm({ singleTilde: false })],
    mdastExtensions: [gfmFromMarkdown()],
  })

  return tree.children.flatMap(child => (child.position?.start.offset ? [child.position.start.offset] : []))
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
