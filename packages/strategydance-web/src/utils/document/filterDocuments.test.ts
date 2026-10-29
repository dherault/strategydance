import { describe, expect, it } from 'bun:test'

import { CompanyAspect } from 'strategydance-database/web'

import type { DocumentSummary } from '~types'

import filterDocuments from '~utils/document/filterDocuments'

function makeDocument(id: string, overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id,
    title: id,
    aspects: [],
    updatedAt: '2026-10-15T10:00:00Z',
    ...overrides,
  }
}

// The latest changed first, as the page reads them
const organizationDocuments = [
  makeDocument('a', { title: 'Positioning for the beta', aspects: [CompanyAspect.STRATEGY, CompanyAspect.MARKETING] }),
  makeDocument('b', { title: 'Launch checklist', aspects: [CompanyAspect.MARKETING, CompanyAspect.PRODUCT] }),
  makeDocument('c', { title: 'Beta pricing', aspects: [CompanyAspect.FINANCES] }),
  makeDocument('d', { title: '' }),
]

function ids(list: DocumentSummary[]) {
  return list.map(organizationDocument => organizationDocument.id)
}

describe('filterDocuments', () => {
  it('keeps every document while nothing is set', () => {
    expect(ids(filterDocuments(organizationDocuments, { query: '', aspects: [] }))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(filterDocuments(organizationDocuments, { query: '  ', aspects: [] }))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('matches words in the title whatever their case', () => {
    expect(ids(filterDocuments(organizationDocuments, { query: ' BETA ', aspects: [] }))).toEqual(['a', 'c'])
    expect(ids(filterDocuments(organizationDocuments, { query: 'for the', aspects: [] }))).toEqual(['a'])
    expect(ids(filterDocuments(organizationDocuments, { query: 'roadmap', aspects: [] }))).toEqual([])
  })

  it('keeps the documents tagged with any of the aspects picked', () => {
    expect(ids(filterDocuments(organizationDocuments, { query: '', aspects: [CompanyAspect.MARKETING] }))).toEqual([
      'a',
      'b',
    ])
    expect(
      ids(
        filterDocuments(organizationDocuments, {
          query: '',
          aspects: [CompanyAspect.PRODUCT, CompanyAspect.FINANCES],
        }),
      ),
    ).toEqual(['b', 'c'])
    expect(ids(filterDocuments(organizationDocuments, { query: '', aspects: [CompanyAspect.LEGAL] }))).toEqual([])
  })

  it('combines the words and the aspects', () => {
    expect(ids(filterDocuments(organizationDocuments, { query: 'beta', aspects: [CompanyAspect.MARKETING] }))).toEqual([
      'a',
    ])
  })
})
