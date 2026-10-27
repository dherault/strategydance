import type { Bill } from '~types'

/*
  The companies the organization's bills paid, as the bill's dialog suggests them: one each, told
  apart by their name trimmed and lowercased, as strategydance-core's spending by company tells
  them apart, spelled as the bill paid last spells it, sorted by name in the reader's language
*/
function listBillCompanies(bills: readonly Pick<Bill, 'company' | 'paidOn'>[], locale: string) {
  const companies = new Map<string, { company: string; paidOn: string }>()

  for (const { company, paidOn } of bills) {
    const name = company.trim()
    const key = name.toLowerCase()
    const known = companies.get(key)

    if (name && (!known || paidOn > known.paidOn)) companies.set(key, { company: name, paidOn })
  }

  return [...companies.values()].map(({ company }) => company).sort((a, b) => a.localeCompare(b, locale))
}

export default listBillCompanies
