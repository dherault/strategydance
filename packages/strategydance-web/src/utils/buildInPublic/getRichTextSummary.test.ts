import { describe, expect, it, spyOn } from 'bun:test'

import getRichTextSummary from '~utils/buildInPublic/getRichTextSummary'

function text(value: string, styles: Record<string, unknown> = {}) {
  return { type: 'text', text: value, styles }
}

function blocks(...values: object[]) {
  return JSON.stringify(values)
}

describe('getRichTextSummary', () => {
  it('reads the first paragraph, styles, links and all', () => {
    const value = blocks(
      {
        type: 'paragraph',
        content: [
          text('Two indexes on '),
          text('task_assignments', { bold: true }),
          { type: 'link', href: 'https://example.com', content: [text(' did it.')] },
        ],
      },
      { type: 'paragraph', content: [text('Next, the cache.')] },
    )

    expect(getRichTextSummary(value).text).toBe('Two indexes on task_assignments did it.')
  })

  it('skips an empty paragraph, reads a line break as a space, and leaves out what is nested', () => {
    const value = blocks(
      { type: 'paragraph' },
      {
        type: 'heading',
        content: [text('Shipped\npricing')],
        children: [{ type: 'paragraph', content: [text('Under it')] }],
      },
    )

    expect(getRichTextSummary(value).text).toBe('Shipped pricing')
  })

  it('finds the first quote', () => {
    const value = blocks(
      { type: 'paragraph', content: [text('Talked to users.')] },
      { type: 'quote', content: [text('  Momentum is  a feature. ')] },
      { type: 'quote', content: [text('Not this one')] },
    )

    expect(getRichTextSummary(value)).toEqual({ text: 'Talked to users.', quote: 'Momentum is a feature.' })
  })

  it('falls back to every word when no paragraph has any', () => {
    const value = blocks(
      { type: 'bulletListItem', content: [text('One')], children: [{ type: 'checkListItem', content: [text('two')] }] },
      { type: 'numberedListItem', content: [text('three')] },
    )

    expect(getRichTextSummary(value)).toEqual({ text: 'One two three', quote: null })
  })

  it('says nothing of an old Lexical value, nor of one that does not parse', () => {
    const consoleError = spyOn(console, 'error').mockImplementation(() => {})

    expect(getRichTextSummary(JSON.stringify({ root: { type: 'root', children: [] } }))).toEqual({
      text: '',
      quote: null,
    })
    expect(getRichTextSummary('not json')).toEqual({ text: '', quote: null })

    consoleError.mockRestore()
  })
})
