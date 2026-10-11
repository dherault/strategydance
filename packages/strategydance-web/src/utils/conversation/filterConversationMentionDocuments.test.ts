import { describe, expect, it } from 'bun:test'

import filterConversationMentionDocuments from '~utils/conversation/filterConversationMentionDocuments'

function titles(documents: { title: string }[]) {
  return documents.map(({ title }) => title)
}

const DOCUMENTS = ['Pricing', '  ', 'Launch plan', '', '  Hiring plan  ', 'Pricing page'].map(title => ({ title }))

describe('filterConversationMentionDocuments', () => {
  it('suggests every titled document for an empty query, in the order they came in', () => {
    expect(titles(filterConversationMentionDocuments(DOCUMENTS, ''))).toEqual([
      'Pricing',
      'Launch plan',
      '  Hiring plan  ',
      'Pricing page',
    ])
  })

  it('suggests the titles holding the query, whatever its case', () => {
    expect(titles(filterConversationMentionDocuments(DOCUMENTS, 'PRI'))).toEqual(['Pricing', 'Pricing page'])
    expect(titles(filterConversationMentionDocuments(DOCUMENTS, 'plan'))).toEqual(['Launch plan', '  Hiring plan  '])
  })

  it('suggests nothing a title does not hold', () => {
    expect(filterConversationMentionDocuments(DOCUMENTS, 'pricing  ')).toEqual([])
    expect(filterConversationMentionDocuments(DOCUMENTS, 'roadmap')).toEqual([])
  })

  it('suggests six at most', () => {
    const documents = Array.from({ length: 8 }, (_, index) => ({ title: `Plan ${index}` }))

    expect(titles(filterConversationMentionDocuments(documents, 'plan'))).toEqual([
      'Plan 0',
      'Plan 1',
      'Plan 2',
      'Plan 3',
      'Plan 4',
      'Plan 5',
    ])
  })
})
