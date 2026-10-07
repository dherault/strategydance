import { describe, expect, test } from 'bun:test'

import mergeConversationText from './mergeConversationText'

function cite(url: string, title: string | null = 'Source', citedText = 'Quoted') {
  return { type: 'web_search_result_location', url, title, cited_text: citedText, encrypted_index: 'x' }
}

describe('mergeConversationText', () => {
  test('merges consecutive text blocks, each cited block a span over its own offsets', () => {
    const merged = mergeConversationText([
      { type: 'text', text: 'Notion charges ', citations: null },
      { type: 'text', text: '10 per member', citations: [cite('https://notion.so/pricing', 'Pricing', '$10')] },
      { type: 'text', text: ', and Coda ' },
      { type: 'text', text: '12', citations: [cite('https://coda.io'), cite('https://coda.io/pricing', null)] },
      { type: 'text', text: '.' },
    ])

    expect(merged.text).toBe('Notion charges 10 per member, and Coda 12.')
    expect(merged.blockEnds).toEqual([15, 28, 39, 41, 42])
    expect(merged.citations).toEqual([
      { start: 15, end: 28, sources: [{ url: 'https://notion.so/pricing', title: 'Pricing', citedText: '$10' }] },
      {
        start: 39,
        end: 41,
        sources: [
          { url: 'https://coda.io', title: 'Source', citedText: 'Quoted' },
          { url: 'https://coda.io/pricing', title: null, citedText: 'Quoted' },
        ],
      },
    ])
    expect(merged.text.slice(15, 28)).toBe('10 per member')
  })

  test('drops U+0000 before counting, so the offsets are into what is stored', () => {
    const merged = mergeConversationText([
      { type: 'text', text: 'A\u0000B ' },
      { type: 'text', text: 'cited', citations: [cite('https://example.com')] },
    ])

    expect(merged.text).toBe('AB cited')
    expect(merged.citations[0]).toMatchObject({ start: 3, end: 8 })
  })

  test('keeps only web search citations, and no span for an empty block', () => {
    const merged = mergeConversationText([
      { type: 'text', text: 'A', citations: [{ type: 'char_location', cited_text: 'x' }] },
      { type: 'text', text: '', citations: [cite('https://example.com')] },
    ])

    expect(merged.citations).toEqual([])
  })
})
