import { describe, expect, it } from 'bun:test'

import { CompanyAspect } from 'strategydance-database/web'

import type { KnowledgeDocumentSummary } from '~types'

import filterKnowledgeDocuments from '~utils/knowledge/filterKnowledgeDocuments'

function makeDocument(id: string, overrides: Partial<KnowledgeDocumentSummary> = {}): KnowledgeDocumentSummary {
  return {
    id,
    title: id,
    aspects: [],
    updatedAt: '2026-10-15T10:00:00Z',
    ...overrides,
  }
}

// The latest changed first, as the page reads them
const knowledgeDocuments = [
  makeDocument('a', { title: 'Positioning for the beta', aspects: [CompanyAspect.STRATEGY, CompanyAspect.MARKETING] }),
  makeDocument('b', { title: 'Launch checklist', aspects: [CompanyAspect.MARKETING, CompanyAspect.PRODUCT] }),
  makeDocument('c', { title: 'Beta pricing', aspects: [CompanyAspect.FINANCES] }),
  makeDocument('d', { title: '' }),
]

function ids(list: KnowledgeDocumentSummary[]) {
  return list.map(knowledgeDocument => knowledgeDocument.id)
}

describe('filterKnowledgeDocuments', () => {
  it('keeps every document while nothing is set', () => {
    expect(ids(filterKnowledgeDocuments(knowledgeDocuments, { query: '', aspects: [] }))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(filterKnowledgeDocuments(knowledgeDocuments, { query: '  ', aspects: [] }))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })

  it('matches words in the title whatever their case', () => {
    expect(ids(filterKnowledgeDocuments(knowledgeDocuments, { query: ' BETA ', aspects: [] }))).toEqual(['a', 'c'])
    expect(ids(filterKnowledgeDocuments(knowledgeDocuments, { query: 'for the', aspects: [] }))).toEqual(['a'])
    expect(ids(filterKnowledgeDocuments(knowledgeDocuments, { query: 'roadmap', aspects: [] }))).toEqual([])
  })

  it('keeps the documents tagged with any of the aspects picked', () => {
    expect(
      ids(filterKnowledgeDocuments(knowledgeDocuments, { query: '', aspects: [CompanyAspect.MARKETING] })),
    ).toEqual(['a', 'b'])
    expect(
      ids(
        filterKnowledgeDocuments(knowledgeDocuments, {
          query: '',
          aspects: [CompanyAspect.PRODUCT, CompanyAspect.FINANCES],
        }),
      ),
    ).toEqual(['b', 'c'])
    expect(ids(filterKnowledgeDocuments(knowledgeDocuments, { query: '', aspects: [CompanyAspect.LEGAL] }))).toEqual([])
  })

  it('combines the words and the aspects', () => {
    expect(
      ids(filterKnowledgeDocuments(knowledgeDocuments, { query: 'beta', aspects: [CompanyAspect.MARKETING] })),
    ).toEqual(['a'])
  })
})
