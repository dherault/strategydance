import { describe, expect, it } from 'bun:test'

import type { Bill } from '~types'

import isBillAsDrafted from '~utils/budget/isBillAsDrafted'
import toBillDraft from '~utils/budget/toBillDraft'
import toBillFormValues from '~utils/budget/toBillFormValues'

const BILL = {
  id: '6f1c2b0e9a4d4c3b8e7f5a6b7c8d9e0f',
  name: 'Cloud hosting',
  description: 'Production and staging',
  company: 'Amazon Web Services',
  amountMinor: 150000,
  currency: 'JPY',
  paidOn: '2026-02-01',
  recurrence: 'QUARTERLY',
  endsOn: null,
  paidById: 'sam',
  receipt: { id: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', name: 'invoice.pdf', contentType: 'application/pdf', size: 2048 },
  createdAt: '2026-02-01T09:00:00Z',
  updatedAt: '2026-02-01T09:00:00Z',
} as Bill

const DEFAULTS = { currency: 'EUR' as const, today: '2026-10-19', viewerId: 'alex', locale: 'fr' }

describe('isBillAsDrafted', () => {
  it('tells the bill a save wrote from one saved otherwise', () => {
    const draft = toBillDraft(toBillFormValues(BILL, DEFAULTS))!

    expect(isBillAsDrafted(BILL, draft)).toBe(true)
    expect(isBillAsDrafted({ ...BILL, amountMinor: 150001 }, draft)).toBe(false)
    expect(isBillAsDrafted({ ...BILL, receipt: undefined }, draft)).toBe(false)
    expect(isBillAsDrafted(BILL, { ...draft, endsOn: '2027-01-31' })).toBe(false)
  })
})
