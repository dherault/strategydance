import { describe, expect, it } from 'bun:test'

import type { BudgetBill } from 'strategydance-core'

import sortBillsByLastPayment from '~utils/budget/sortBillsByLastPayment'

const TODAY = '2026-10-19'

function makeBill(id: string, name: string, paidOn: string, recurrence: BudgetBill['recurrence'] = null): BudgetBill {
  return { id, name, company: 'Company', amountMinor: 1000, currency: 'USD', paidOn, recurrence, endsOn: null }
}

describe('sortBillsByLastPayment', () => {
  it('lists the bills by their last payment, newest first, one still ahead on top', () => {
    const bills = [
      makeBill('a', 'Old one-time', '2026-01-10'),
      makeBill('b', 'Monthly since March', '2026-03-05', 'MONTHLY'),
      makeBill('c', 'Due next month', '2026-11-02'),
      makeBill('d', 'Last week', '2026-10-12'),
    ]

    expect(sortBillsByLastPayment(bills, TODAY).map(({ id }) => id)).toEqual(['c', 'd', 'b', 'a'])
  })

  it('breaks a tie by name, then by id', () => {
    const bills = [
      makeBill('b', 'Zoom', '2026-10-01'),
      makeBill('c', 'Adobe', '2026-10-01'),
      makeBill('a', 'Adobe', '2026-10-01'),
    ]

    expect(sortBillsByLastPayment(bills, TODAY).map(({ id }) => id)).toEqual(['a', 'c', 'b'])
  })
})
