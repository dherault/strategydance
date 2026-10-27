import { describe, expect, it } from 'bun:test'

import filterBills from '~utils/budget/filterBills'

const BILLS = [
  { name: 'Figma Professional', description: 'Design seats', company: 'Figma', paidById: 'alex' },
  { name: 'Cloud hosting', description: 'Production and staging', company: 'Amazon Web Services', paidById: 'sam' },
  { name: 'Legal review', description: '', company: 'Cooley', paidById: 'alex' },
]

describe('filterBills', () => {
  it('keeps every bill with no search and no payer', () => {
    expect(filterBills(BILLS, { query: '  ', payerId: null })).toEqual(BILLS)
  })

  it('finds every word, case aside, in the name, the description or the company', () => {
    expect(filterBills(BILLS, { query: 'FIGMA', payerId: null }).map(({ name }) => name)).toEqual([
      'Figma Professional',
    ])
    expect(filterBills(BILLS, { query: 'staging amazon', payerId: null }).map(({ name }) => name)).toEqual([
      'Cloud hosting',
    ])
    expect(filterBills(BILLS, { query: 'cloud figma', payerId: null })).toEqual([])
  })

  it("keeps the payer's bills alone", () => {
    expect(filterBills(BILLS, { query: '', payerId: 'alex' }).map(({ name }) => name)).toEqual([
      'Figma Professional',
      'Legal review',
    ])
    expect(filterBills(BILLS, { query: 'legal', payerId: 'sam' })).toEqual([])
  })
})
