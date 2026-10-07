import { describe, expect, test } from 'bun:test'

import selectPieceCitations from './selectPieceCitations'
import splitConversationText from './splitConversationText'

const BOUND = 20000

function split(text: string, blockEnds: number[] = []) {
  const pieces = splitConversationText(text, blockEnds)

  // Every piece within the bound, and the pieces rejoining into the text
  for (const { start, end } of pieces) expect(end - start).toBeLessThanOrEqual(BOUND)

  expect(pieces.map(({ start, end }) => text.slice(start, end)).join('')).toBe(text)

  return pieces
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
})
