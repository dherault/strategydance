import { describe, expect, it } from 'bun:test'

import getRichTextSummary from '~utils/buildInPublic/getRichTextSummary'

function text(value: string) {
  return { type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text: value }
}

function state(...children: object[]) {
  return JSON.stringify({ root: { type: 'root', version: 1, children } })
}

describe('getRichTextSummary', () => {
  it('reads the first paragraph, formats and all', () => {
    const value = state(
      {
        type: 'paragraph',
        children: [text('Two indexes on '), { ...text('task_assignments'), format: 1 }, text(' did it.')],
      },
      { type: 'paragraph', children: [text('Next, the cache.')] },
    )

    expect(getRichTextSummary(value).text).toBe('Two indexes on task_assignments did it.')
  })

  it('skips an empty paragraph, and reads a line break as a space', () => {
    const value = state(
      { type: 'paragraph', children: [] },
      { type: 'heading', tag: 'h2', children: [text('Shipped'), { type: 'linebreak' }, text('pricing')] },
    )

    expect(getRichTextSummary(value).text).toBe('Shipped pricing')
  })

  it('finds the first quote', () => {
    const value = state(
      { type: 'paragraph', children: [text('Talked to users.')] },
      { type: 'quote', children: [text('  Momentum is  a feature. ')] },
      { type: 'quote', children: [text('Not this one')] },
    )

    expect(getRichTextSummary(value)).toEqual({ text: 'Talked to users.', quote: 'Momentum is a feature.' })
  })

  it('falls back to every word when no paragraph has any', () => {
    const value = state({
      type: 'list',
      listType: 'bullet',
      children: [
        { type: 'listitem', children: [text('One')] },
        { type: 'listitem', children: [text(' two')] },
      ],
    })

    expect(getRichTextSummary(value)).toEqual({ text: 'One two', quote: null })
  })

  it('says nothing of a value that does not parse', () => {
    expect(getRichTextSummary('not json')).toEqual({ text: '', quote: null })
  })
})
