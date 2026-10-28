import { describe, expect, it } from 'bun:test'

import type { BillReceiptFields } from 'strategydance-core'

import toBillFormValuesFromReceipt from '~utils/budget/toBillFormValuesFromReceipt'

const DEFAULTS = { currency: 'EUR' as const, today: '2026-10-27', viewerId: 'alex' }
const RECEIPT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'

const FIELDS: BillReceiptFields = {
  name: 'Figma Professional',
  description: 'Design seats',
  company: 'Figma',
  amount: '45.00',
  currency: 'USD',
  paidOn: '2026-10-03',
  recurrence: 'MONTHLY',
}

describe('toBillFormValuesFromReceipt', () => {
  it('lays what the receipt says over a new bill, paid by the reader, its receipt attached', () => {
    expect(toBillFormValuesFromReceipt(FIELDS, RECEIPT_ID, DEFAULTS)).toEqual({
      name: 'Figma Professional',
      description: 'Design seats',
      company: 'Figma',
      amount: '45.00',
      currency: 'USD',
      paidOn: '2026-10-03',
      paidById: 'alex',
      isRecurring: true,
      recurrence: 'MONTHLY',
      endsOn: null,
      receiptId: RECEIPT_ID,
    })
  })

  it("keeps the budget's currency and a one-time payment when the receipt names neither", () => {
    expect(
      toBillFormValuesFromReceipt({ ...FIELDS, currency: null, recurrence: null }, RECEIPT_ID, DEFAULTS),
    ).toMatchObject({ currency: 'EUR', amount: '45.00', isRecurring: false, recurrence: 'MONTHLY' })
  })

  it('leaves an amount to type when its currency cannot hold it', () => {
    expect(
      toBillFormValuesFromReceipt({ ...FIELDS, amount: '1500.50', currency: 'JPY' }, RECEIPT_ID, DEFAULTS).amount,
    ).toBe('')
    expect(
      toBillFormValuesFromReceipt({ ...FIELDS, amount: '12.505', currency: null }, RECEIPT_ID, DEFAULTS).amount,
    ).toBe('')
    expect(toBillFormValuesFromReceipt({ ...FIELDS, amount: null }, RECEIPT_ID, DEFAULTS).amount).toBe('')
  })

  it('attaches the receipt to an empty bill when nothing was read', () => {
    expect(toBillFormValuesFromReceipt(null, RECEIPT_ID, DEFAULTS)).toMatchObject({
      name: '',
      company: '',
      amount: '',
      currency: 'EUR',
      paidOn: '2026-10-27',
      receiptId: RECEIPT_ID,
    })
  })
})
