import { createHash } from 'node:crypto'

import type { KnowledgeDocumentBlock } from '~types'

import { KNOWLEDGE_READ_PAGE_LENGTH } from '~constants'

// What a block costs a page beside its Markdown and its id: the JSON around them in the result
const BLOCK_OVERHEAD = 48

// How many hex digits of a block's SHA-256 a cursor keeps
const BLOCK_HASH_LENGTH = 16

// Where a page starts: a block's id, how far into its Markdown, and, past its start, a hash of that
// Markdown, so a page that carries on from inside a block knows whether the block changed meanwhile
export type KnowledgeDocumentCursor = {
  id: string
  offset: number
  hash?: string
}

// A block of a page: its id and its Markdown, or the part of it the page holds, from `offset`, and
// `isCut` when the page stops inside it
export type KnowledgeDocumentPageBlock = KnowledgeDocumentBlock & {
  offset?: number
  isCut?: true
}

type KnowledgeDocumentPage = {
  blocks: KnowledgeDocumentPageBlock[]
  // Where the next page starts, while more remains
  next: KnowledgeDocumentCursor | null
  // Why the page starts elsewhere than its cursor said: the block it stopped inside was edited, so
  // it starts that block again, or the block is gone, so it starts the document again
  restart?: 'block' | 'document'
}

/*
  One page of a document's top-level blocks, from a cursor, at most `budget` characters as the
  result's JSON writes them, each block's Markdown escaped and counted with its id and the JSON
  around it, so a page of quotes, backslashes or line breaks fits as surely as one of words. A page
  ends at a block's end when it can, and inside a block only when that block alone passes the
  budget, as a single 200000-character paragraph would, never inside a character a surrogate pair
  writes.

  The next page carries on from the block its cursor names however the text around it changed. One
  that stopped inside a block starts that block again once the block was edited, rather than repeat
  or skip text, and one whose block was deleted starts the document again
*/
function paginateKnowledgeDocumentBlocks(
  blocks: readonly KnowledgeDocumentBlock[],
  cursor: KnowledgeDocumentCursor | null,
  budget = KNOWLEDGE_READ_PAGE_LENGTH,
): KnowledgeDocumentPage {
  const { index: start, offset: startOffset, restart } = locate(blocks, cursor)
  const page: KnowledgeDocumentPageBlock[] = []
  let remaining = budget

  for (let index = start; index < blocks.length; index++) {
    const block = blocks[index]!
    const offset = index === start ? startOffset : 0
    const markdown = block.markdown.slice(offset)
    const cost = jsonLength(markdown) + jsonLength(block.id) + BLOCK_OVERHEAD

    if (cost <= remaining) {
      page.push(offset > 0 ? { id: block.id, markdown, offset } : { id: block.id, markdown })
      remaining -= cost

      continue
    }

    // A block that passes what is left starts the next page, unless it alone passes a whole page
    if (page.length > 0) return { blocks: page, next: { id: block.id, offset: 0 }, ...(restart && { restart }) }

    const length = cutLength(markdown, remaining - jsonLength(block.id) - BLOCK_OVERHEAD)
    const end = offset + length

    page.push({ id: block.id, markdown: markdown.slice(0, length), ...(offset > 0 && { offset }), isCut: true })

    return {
      blocks: page,
      next: { id: block.id, offset: end, hash: hashBlock(block) },
      ...(restart && { restart }),
    }
  }

  return { blocks: page, next: null, ...(restart && { restart }) }
}

// Where a cursor starts in the blocks as they stand now
function locate(blocks: readonly KnowledgeDocumentBlock[], cursor: KnowledgeDocumentCursor | null) {
  if (!cursor) return { index: 0, offset: 0 }

  const index = blocks.findIndex(block => block.id === cursor.id)

  if (index === -1) return { index: 0, offset: 0, restart: 'document' as const }

  const block = blocks[index]!

  if (cursor.offset === 0) return { index, offset: 0 }

  if (cursor.hash !== hashBlock(block) || cursor.offset >= block.markdown.length) {
    return { index, offset: 0, restart: 'block' as const }
  }

  return { index, offset: cursor.offset }
}

// How long a text is once written as a JSON string, without its quotes
function jsonLength(text: string) {
  return JSON.stringify(text).length - 2
}

// How long one character, by its code, is in a JSON string: a quote or a backslash is escaped, a
// control character written as an escape or its code, and a lone surrogate as its code
function jsonCharacterLength(code: number) {
  if (code === 0x22 || code === 0x5c) return 2
  if (code < 0x20) return jsonLength(String.fromCharCode(code))
  if (code >= 0xd800 && code <= 0xdfff) return 6

  return 1
}

/*
  How much of a text fits in a JSON budget, in its own characters, never inside a character a
  surrogate pair writes, and at least one character, so a page always moves on
*/
function cutLength(text: string, budget: number) {
  let cost = 0
  let length = 0

  while (length < text.length) {
    const code = text.charCodeAt(length)
    const next = text.charCodeAt(length + 1)
    const width = code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff ? 2 : 1
    const characterCost = width === 2 ? 2 : jsonCharacterLength(code)

    if (cost + characterCost > budget && length > 0) break

    cost += characterCost
    length += width
  }

  return length
}

function hashBlock(block: KnowledgeDocumentBlock) {
  return createHash('sha256').update(block.markdown).digest('hex').slice(0, BLOCK_HASH_LENGTH)
}

export default paginateKnowledgeDocumentBlocks
