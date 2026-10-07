import { describe, expect, test } from 'bun:test'

import parseConversationCitations from './parseConversationCitations'

describe('parseConversationCitations', () => {
  test('reads the citations a reply keeps, whatever order their keys come in', () => {
    expect(
      parseConversationCitations([
        {
          sources: [{ citedText: '$10', title: 'Notion pricing', url: 'https://notion.so/pricing' }],
          end: 28,
          start: 15,
        },
      ]),
    ).toEqual([
      {
        start: 15,
        end: 28,
        sources: [{ url: 'https://notion.so/pricing', title: 'Notion pricing', citedText: '$10' }],
      },
    ])
  })

  test('leaves out what has not their shape, and a source that is not a web address', () => {
    expect(parseConversationCitations(null)).toEqual([])
    expect(parseConversationCitations({ start: 1 })).toEqual([])
    expect(
      parseConversationCitations([
        { start: '1', end: 2, sources: [{ url: 'https://example.com' }] },
        { start: 1, end: 2, sources: [{ url: 'javascript:alert(1)' }, { url: 'not an address' }] },
        { start: 1, end: 2, sources: [{ url: 'https://example.com', title: ' ' }] },
      ]),
    ).toEqual([{ start: 1, end: 2, sources: [{ url: 'https://example.com', title: null, citedText: '' }] }])
  })
})
