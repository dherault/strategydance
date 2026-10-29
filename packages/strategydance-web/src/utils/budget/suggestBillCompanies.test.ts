import { describe, expect, it } from 'bun:test'

import suggestBillCompanies from '~utils/budget/suggestBillCompanies'

const COMPANIES = ['Amazon Web Services', 'Figma', 'Figma Japan', 'Google']

describe('suggestBillCompanies', () => {
  it('suggests every company while the field is empty', () => {
    expect(suggestBillCompanies(COMPANIES, ' ')).toEqual(COMPANIES)
  })

  it('suggests the companies holding the text, case aside', () => {
    expect(suggestBillCompanies(COMPANIES, 'FIG')).toEqual(['Figma', 'Figma Japan'])
    expect(suggestBillCompanies(COMPANIES, 'web')).toEqual(['Amazon Web Services'])
  })

  it('leaves out the company the field already names', () => {
    expect(suggestBillCompanies(COMPANIES, 'figma')).toEqual(['Figma Japan'])
    expect(suggestBillCompanies(COMPANIES, 'Google')).toEqual([])
  })
})
