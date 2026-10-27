import { describe, expect, it } from 'bun:test'

import listBillCompanies from '~utils/budget/listBillCompanies'

describe('listBillCompanies', () => {
  it('lists each company once, sorted by name', () => {
    expect(
      listBillCompanies(
        [
          { company: 'Figma', paidOn: '2026-01-01' },
          { company: 'Amazon Web Services', paidOn: '2026-02-01' },
          { company: 'Figma', paidOn: '2026-03-01' },
        ],
        'en',
      ),
    ).toEqual(['Amazon Web Services', 'Figma'])
  })

  it('tells companies apart by their trimmed, lowercased name, spelled as the latest bill spells it', () => {
    expect(
      listBillCompanies(
        [
          { company: 'figma ', paidOn: '2026-01-01' },
          { company: 'FIGMA', paidOn: '2026-05-01' },
          { company: 'Figma', paidOn: '2026-03-01' },
        ],
        'en',
      ),
    ).toEqual(['FIGMA'])
  })
})
