import { describe, expect, it } from 'bun:test'

import { DOCUMENT_SEARCH_EXCERPT_LENGTH } from '~constants'

import cutDocumentSearchExcerpt from './cutDocumentSearchExcerpt'

describe('cutDocumentSearchExcerpt', () => {
  it('keeps a short text whole, on one line', () => {
    expect(cutDocumentSearchExcerpt('Pricing\nWe charge   monthly.', ['monthly'])).toBe('Pricing We charge monthly.')
  })

  it('cuts a long text around the first matched word, ignoring case, with an ellipsis where it cut', () => {
    const text = `${'before '.repeat(100)}The MONTHLY plan${' after'.repeat(100)}`
    const excerpt = cutDocumentSearchExcerpt(text, ['absent', 'monthly'])

    expect(excerpt).toContain('The MONTHLY plan')
    expect(excerpt.startsWith('…')).toBe(true)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt.length).toBeLessThanOrEqual(DOCUMENT_SEARCH_EXCERPT_LENGTH + 2)
  })

  it('starts at the beginning when no word occurs in the text, as when the title alone matched', () => {
    const text = 'word '.repeat(200)

    expect(cutDocumentSearchExcerpt(text, ['title']).startsWith('word word')).toBe(true)
  })

  it('reads a word of a query as text, never as a pattern', () => {
    const text = `${'x'.repeat(300)} costs $5 (or more) ${'y'.repeat(300)}`

    expect(cutDocumentSearchExcerpt(text, ['(or'])).toContain('(or more)')
  })

  it('never cuts inside a character a surrogate pair writes', () => {
    const excerpt = cutDocumentSearchExcerpt('😀'.repeat(400), ['none'])

    expect(excerpt.replace(/…/g, '').length % 2).toBe(0)
  })
})
