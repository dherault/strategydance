import { describe, expect, test } from 'bun:test'

import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'

import readPieceText from './readPieceText'
import selectPieceCitations from './selectPieceCitations'
import splitConversationText from './splitConversationText'

const BOUND = 20000

function split(text: string, blockEnds: number[] = []) {
  const pieces = splitConversationText(text, blockEnds)

  // Every piece within the bound as drawn, and the pieces rejoining into the text
  for (const piece of pieces) expect(readPieceText(text, piece).length).toBeLessThanOrEqual(BOUND)

  expect(pieces.map(({ start, end }) => text.slice(start, end)).join('')).toBe(text)

  return pieces
}

// A piece's top-level Markdown blocks, as the thread's Markdown reads them
function parse(markdown: string) {
  return fromMarkdown(markdown, { extensions: [gfm({ singleTilde: false })], mdastExtensions: [gfmFromMarkdown()] })
    .children
}

describe('splitConversationText', () => {
  test('leaves a text within the bound whole', () => {
    expect(split('A short reply.')).toEqual([{ start: 0, end: 14 }])
  })

  test('splits between the model’s text blocks first', () => {
    const first = 'a'.repeat(15000)
    const second = '\n\n' + 'b '.repeat(4000)
    const pieces = split(first + second + 'c'.repeat(9000), [15000, 15000 + second.length])

    expect(pieces[0]).toEqual({ start: 0, end: 15000 })
  })

  test('splits one block between its top-level Markdown blocks, never inside a list', () => {
    const paragraph = 'word '.repeat(2000) + '\n\n'
    // About 13000 characters, which would cross the bound after the paragraph
    const list = Array.from({ length: 1200 }, (_, index) => `- item ${index}`).join('\n') + '\n\n'
    const text = paragraph + list + 'tail '.repeat(1000)
    const pieces = split(text)

    expect(pieces[0]?.end).toBe(paragraph.length)
    expect(text.slice(pieces[1]?.start, pieces[1]?.end)).toStartWith('- item 0')
    expect(text.slice(pieces[1]?.start, pieces[1]?.end)).toContain('- item 1199')
  })

  test('splits a single long block at a line break', () => {
    const text = Array.from({ length: 2500 }, (_, index) => `line ${index} of one paragraph`).join('\n')
    const pieces = split(text)

    expect(pieces.length).toBeGreaterThan(1)

    for (const piece of pieces.slice(0, -1)) expect(text[piece.end - 1]).toBe('\n')
  })

  test('splits a 50000-character line at spaces', () => {
    const text = 'word '.repeat(10000)
    const pieces = split(text)

    expect(pieces.length).toBe(3)

    for (const piece of pieces.slice(0, -1)) expect(text[piece.end - 1]).toBe(' ')
  })

  test('splits a line with no space at a grapheme boundary', () => {
    const pieces = split('é'.normalize('NFD').repeat(15000))

    // Each "é" is two code units, a letter and its accent, never parted
    for (const piece of pieces) expect(piece.start % 2).toBe(0)
  })

  test('closes a fenced code block a cut runs through, and opens it again in the next piece', () => {
    const code = Array.from({ length: 1500 }, (_, index) => `const value${index} = ${index}`).join('\n')
    const text = 'Here is the file:\n\n```ts\n' + code + '\n```\n\nThat is all.'
    const drawn = split(text).map(piece => readPieceText(text, piece))

    // Between the blocks first, then inside the code, which is past the bound by itself
    expect(drawn.length).toBe(3)
    expect(drawn[0]).toBe('Here is the file:\n\n')
    expect(drawn[1]).toStartWith('```ts\n')
    expect(drawn[1]).toEndWith('\n```')
    expect(drawn[2]).toStartWith('```ts\n')

    // Every line of the code drawn as code, in one piece or the other, and nothing else
    const blocks = drawn.map(parse)
    const codes = blocks.flatMap(children => children.flatMap(child => (child.type === 'code' ? [child.value] : [])))

    expect(codes.join('\n')).toBe(code)
    expect(blocks.flat().filter(({ type }) => type === 'paragraph').length).toBe(2)
  })

  test('cuts a line earlier rather than right before a fence’s closing line', () => {
    // The fence's content ends at 19997, so its closing line would end exactly at the bound
    const content = ('x'.repeat(99) + '\n').repeat(199) + 'y'.repeat(92) + '\n'
    const text = '```\n' + content + '```\n\n' + 'tail '.repeat(100)
    const pieces = split(text)

    expect(readPieceText(text, pieces[0] ?? { start: 0, end: 0 })).toEndWith('x\n```')
    expect(readPieceText(text, pieces[1] ?? { start: 0, end: 0 })).toStartWith('```\n' + 'y'.repeat(92) + '\n```')
  })

  test('repeats a table’s head in each piece a cut runs through', () => {
    const head = '| Plan | Price |\n| --- | --- |\n'
    const rows = Array.from({ length: 1500 }, (_, index) => `| Plan ${index} | ${index} |`)
    const text = head + rows.join('\n')
    const drawn = split(text).map(piece => readPieceText(text, piece))

    expect(drawn.length).toBe(2)

    const tables = drawn.map(piece => parse(piece))

    for (const children of tables) {
      expect(children.map(({ type }) => type)).toEqual(['table'])
      expect(drawn[tables.indexOf(children)]).toStartWith(head)
    }

    // Every row once, under its head in each piece
    const rowCount = tables
      .flat()
      .reduce((count, table) => count + ('children' in table ? table.children.length - 1 : 0), 0)

    expect(rowCount).toBe(rows.length)
  })

  test('keeps an emoji sequence across the bound whole', () => {
    const family = '👨‍👩‍👧‍👦'
    const text = 'a'.repeat(BOUND - 3) + family + 'b'.repeat(100)
    const pieces = split(text)

    expect(pieces[0]?.end).toBe(BOUND - 3)
    expect(text.slice(pieces[1]?.start ?? 0)).toStartWith(family)
  })
})

describe('selectPieceCitations', () => {
  test('keeps the citations whose span starts in the piece, rebased and clipped at its end', () => {
    const sources = [{ url: 'https://example.com', title: null, citedText: 'x' }]
    const citations = [
      { start: 5, end: 10, sources },
      { start: 95, end: 120, sources },
      { start: 130, end: 140, sources },
    ]

    expect(selectPieceCitations(citations, { start: 0, end: 100 })).toEqual([
      { start: 5, end: 10, sources },
      { start: 95, end: 100, sources },
    ])
    expect(selectPieceCitations(citations, { start: 100, end: 200 })).toEqual([{ start: 30, end: 40, sources }])
  })

  test('rebases a piece’s citations past what reopens a block a cut ran through', () => {
    const sources = [{ url: 'https://example.com', title: null, citedText: 'x' }]

    expect(
      selectPieceCitations([{ start: 130, end: 140, sources }], { start: 100, end: 200, before: '```ts\n' }),
    ).toEqual([{ start: 36, end: 46, sources }])
  })
})
