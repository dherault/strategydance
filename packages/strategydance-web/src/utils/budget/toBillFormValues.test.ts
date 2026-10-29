import { describe, expect, it } from 'bun:test'

import type { Bill } from '~types'

import toBillFormValues from '~utils/budget/toBillFormValues'

const DEFAULTS = { currency: 'EUR' as const, today: '2026-10-19', viewerId: 'alex', locale: 'en' }

const BILL = {
  id: '6f1c2b0e9a4d4c3b8e7f5a6b7c8d9e0f',
  name: 'Cloud hosting',
  description: 'Production and staging',
  company: 'Amazon Web Services',
  amountMinor: 150000,
  currency: 'JPY',
  paidOn: '2026-02-01',
  recurrence: 'QUARTERLY',
  endsOn: '2027-01-31',
  paidById: 'sam',
  paidBy: { displayName: 'Sam Lee', imageUrl: null, imageThumbnailUrl: null },
  receipt: { id: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', name: 'invoice.pdf', contentType: 'application/pdf', size: 2048 },
  createdById: 'sam',
  createdAt: '2026-02-01T09:00:00Z',
  updatedAt: '2026-02-01T09:00:00Z',
} as Bill

describe('toBillFormValues', () => {
  it("starts a new bill today, paid by the reader in the budget's currency", () => {
    expect(toBillFormValues(null, DEFAULTS)).toEqual({
      name: '',
      description: '',
      company: '',
      amount: '',
      currency: 'EUR',
      paidOn: '2026-10-19',
      paidById: 'alex',
      isRecurring: false,
      recurrence: 'MONTHLY',
      endsOn: null,
      receiptId: null,
    })
  })

  it("reads a bill's own fields, its amount in its currency's digits", () => {
    expect(toBillFormValues(BILL, DEFAULTS)).toEqual({
      name: 'Cloud hosting',
      description: 'Production and staging',
      company: 'Amazon Web Services',
      amount: '150000',
      currency: 'JPY',
      paidOn: '2026-02-01',
      paidById: 'sam',
      isRecurring: true,
      recurrence: 'QUARTERLY',
      endsOn: '2027-01-31',
      receiptId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    })
    expect(toBillFormValues({ ...BILL, amountMinor: 31240, currency: 'USD' }, DEFAULTS).amount).toBe('312.40')
  })
})
