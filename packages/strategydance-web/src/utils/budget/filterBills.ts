import type { Bill } from '~types'

type BillFilters = {
  // Words that must each be found in the bill's name, description or company, case aside
  query: string
  // The payer whose bills are kept, everyone's when null
  payerId: string | null
}

// The bills the Bills tab lists under its search and its payer
function filterBills<T extends Pick<Bill, 'name' | 'description' | 'company' | 'paidById'>>(
  bills: readonly T[],
  { query, payerId }: BillFilters,
) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  return bills.filter(bill => {
    if (payerId !== null && bill.paidById !== payerId) return false

    const text = `${bill.name} ${bill.description} ${bill.company}`.toLowerCase()

    return words.every(word => text.includes(word))
  })
}

export { type BillFilters }

export default filterBills
