import { describe, expect, it } from 'bun:test'

import { BillRecurrence, Currency } from 'strategydance-database/web'

import toBudgetBill from '~utils/budget/toBudgetBill'

const ROW = {
  id: '6f1c2b0e9a4d4c3b8e7f5a6b7c8d9e0f',
  name: 'Cloud hosting',
  description: 'Production and staging',
  company: 'Amazon Web Services',
  amountMinor: '31240',
  currency: Currency.USD,
  paidOn: '2026-02-01',
  createdAt: '2026-02-01T09:00:00Z',
  updatedAt: '2026-02-01T09:00:00Z',
}

describe('toBudgetBill', () => {
  it('reads the amount as a number of minor units', () => {
    expect(toBudgetBill({ ...ROW, amountMinor: '1000000000000000' }).amountMinor).toBe(10 ** 15)
    expect(toBudgetBill(ROW).amountMinor).toBe(31240)
  })

  it('reads a one-time bill with no recurrence and no end', () => {
    expect(toBudgetBill(ROW)).toMatchObject({ recurrence: null, endsOn: null })
  })

  it('keeps the recurrence, the end and the rest of the row', () => {
    expect(
      toBudgetBill({ ...ROW, recurrence: BillRecurrence.MONTHLY, endsOn: '2026-12-31', paidById: 'alex' }),
    ).toMatchObject({
      name: 'Cloud hosting',
      description: 'Production and staging',
      recurrence: 'MONTHLY',
      endsOn: '2026-12-31',
      paidById: 'alex',
    })
  })
})
