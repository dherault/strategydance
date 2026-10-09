import { describe, expect, it } from 'bun:test'

import type { KnowledgeDocumentBlock } from '~types'

import { KNOWLEDGE_READ_PAGE_LENGTH } from '~constants'

import paginateKnowledgeDocumentBlocks, { type KnowledgeDocumentCursor } from './paginateKnowledgeDocumentBlocks'

function blocks(count: number, length: number): KnowledgeDocumentBlock[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `block-${index}`,
    markdown: `${String(index).padStart(5, '0')} ${'x'.repeat(length - 6)}`,
  }))
}

// Every page of a document from its start, as an agent reads it, following `next`
function readAll(document: KnowledgeDocumentBlock[], budget?: number) {
  const pages = []
  let cursor: KnowledgeDocumentCursor | null = null

  do {
    const page = paginateKnowledgeDocumentBlocks(document, cursor, budget)

    pages.push(page)
    cursor = page.next
  } while (cursor && pages.length < 1000)

  return pages
}

// The pages joined back into blocks, a block cut across pages joined whole
function join(pages: ReturnType<typeof readAll>) {
  const joined: KnowledgeDocumentBlock[] = []

  for (const block of pages.flatMap(page => page.blocks)) {
    const last = joined.at(-1)

    if (block.offset !== undefined && last?.id === block.id) last.markdown += block.markdown
    else joined.push({ id: block.id, markdown: block.markdown })
  }

  return joined
}

describe('paginateKnowledgeDocumentBlocks', () => {
  it('reads a short document in one page', () => {
    const document = blocks(3, 20)
    const page = paginateKnowledgeDocumentBlocks(document, null)

    expect(page.blocks).toEqual(document)
    expect(page.next).toBeNull()
  })

  it('reads a long document in pages, each ending at a block, which join back whole', () => {
    const document = blocks(1200, 100)
    const pages = readAll(document)

    expect(pages.length).toBeGreaterThan(1)
    expect(join(pages)).toEqual(document)

    for (const page of pages) {
      expect(page.blocks.every(block => block.offset === undefined && !block.isCut)).toBe(true)
      expect(JSON.stringify(page.blocks).length).toBeLessThan(50000)
    }
  })

  it('reads a single 200000-character paragraph in parts, cut inside it only because it passes a page', () => {
    const document = [{ id: 'only', markdown: 'y'.repeat(200000) }]
    const pages = readAll(document)

    expect(pages.length).toBeGreaterThan(5)
    expect(pages.every(page => page.blocks[0]!.markdown.length <= KNOWLEDGE_READ_PAGE_LENGTH)).toBe(true)
    expect(join(pages)).toEqual(document)
    expect(pages[0]!.blocks[0]!.isCut).toBe(true)
    expect(pages[1]!.blocks[0]!.offset).toBe(pages[0]!.blocks[0]!.markdown.length)
  })

  it('starts a block that passes what a page has left on the next page, rather than cut it', () => {
    const document = [
      { id: 'short', markdown: 'a'.repeat(100) },
      { id: 'long', markdown: 'b'.repeat(60000) },
    ]
    const first = paginateKnowledgeDocumentBlocks(document, null)

    expect(first.blocks).toEqual([document[0]!])
    expect(first.next).toEqual({ id: 'long', offset: 0 })
  })

  it('never cuts inside a character a surrogate pair writes', () => {
    const document = [{ id: 'emoji', markdown: '😀'.repeat(30000) }]
    const pages = readAll(document)

    for (const page of pages) expect(page.blocks[0]!.markdown.length % 2).toBe(0)

    expect(join(pages)).toEqual(document)
  })

  it('carries on from its block however the text around it changed', () => {
    const document = blocks(1200, 100)
    const first = paginateKnowledgeDocumentBlocks(document, null)
    const changed = [{ id: 'new', markdown: 'typed meanwhile' }, ...document]
    const second = paginateKnowledgeDocumentBlocks(changed, first.next)

    expect(second.blocks[0]!.id).toBe(first.next!.id)
    expect(second.restart).toBeUndefined()
  })

  it('starts a block it stopped inside again once that block was edited', () => {
    const document = [{ id: 'only', markdown: 'y'.repeat(100000) }]
    const first = paginateKnowledgeDocumentBlocks(document, null)
    const second = paginateKnowledgeDocumentBlocks([{ id: 'only', markdown: `z${'y'.repeat(100000)}` }], first.next)

    expect(second.restart).toBe('block')
    expect(second.blocks[0]!.offset).toBeUndefined()
    expect(second.blocks[0]!.markdown.startsWith('zy')).toBe(true)
  })

  it('starts the document again once the block its cursor names is gone', () => {
    const document = blocks(1200, 100)
    const first = paginateKnowledgeDocumentBlocks(document, null)
    const second = paginateKnowledgeDocumentBlocks(
      document.filter(block => block.id !== first.next!.id),
      first.next,
    )

    expect(second.restart).toBe('document')
    expect(second.blocks[0]!.id).toBe('block-0')
  })

  it('reads an empty document as no blocks', () => {
    expect(paginateKnowledgeDocumentBlocks([], null)).toEqual({ blocks: [], next: null })
  })
})
