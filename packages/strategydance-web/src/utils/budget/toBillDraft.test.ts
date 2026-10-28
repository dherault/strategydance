import { describe, expect, it } from 'bun:test'

import type { Bill } from '~types'

import toBillDraft from '~utils/budget/toBillDraft'
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

describe('toBillDraft', () => {
  it('trims the words and reads the amount in minor units', () => {
    expect(
      toBillDraft({
        ...toBillFormValues(null, DEFAULTS),
        name: ' Figma ',
        description: ' Design seats ',
        company: 'Figma ',
        amount: ' 45.50 ',
      }),
    ).toEqual({
      name: 'Figma',
      description: 'Design seats',
      company: 'Figma',
      amountMinor: 4550,
      currency: 'EUR',
      paidOn: '2026-10-19',
      recurrence: null,
      endsOn: null,
      paidById: 'alex',
      receiptId: null,
    })
  })

  it('puts a name and a company pasted on several lines on one, the description kept as written', () => {
    expect(
      toBillDraft({
        ...toBillFormValues(null, DEFAULTS),
        name: 'Figma\u2028Professional\u00A0',
        description: 'Design\nseats',
        company: 'Figma\r\nInc',
        amount: '45',
      }),
    ).toMatchObject({ name: 'Figma Professional', description: 'Design\nseats', company: 'Figma Inc' })
  })

  it('keeps the recurrence and the end only while the bill recurs', () => {
    const values = { ...toBillFormValues(BILL, DEFAULTS) }

    expect(toBillDraft(values)).toMatchObject({ recurrence: 'QUARTERLY', endsOn: '2027-01-31' })
    expect(toBillDraft({ ...values, isRecurring: false })).toMatchObject({ recurrence: null, endsOn: null })
  })

  it('answers nothing for an amount its currency refuses, or no day', () => {
    expect(toBillDraft({ ...toBillFormValues(BILL, DEFAULTS), amount: '1500.5' })).toBeNull()
    expect(toBillDraft({ ...toBillFormValues(BILL, DEFAULTS), paidOn: null })).toBeNull()
  })
})
