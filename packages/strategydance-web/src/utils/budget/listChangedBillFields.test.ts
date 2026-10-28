import { describe, expect, it } from 'bun:test'

import listChangedBillFields from '~utils/budget/listChangedBillFields'
import toBillFormValues from '~utils/budget/toBillFormValues'

const READ = toBillFormValues(null, { currency: 'EUR', today: '2026-10-19', viewerId: 'alex', locale: 'en' })

describe('listChangedBillFields', () => {
  it('names the fields the reader changed, and none they left', () => {
    expect(listChangedBillFields(READ, { ...READ })).toEqual([])
    expect(
      listChangedBillFields(READ, { ...READ, amount: '18.00', isRecurring: true, receiptId: 'a1b2', endsOn: null }),
    ).toEqual(['amount', 'currency', 'isRecurring', 'receiptId'])
  })

  it('names the amount and the currency together when either changed', () => {
    expect(listChangedBillFields(READ, { ...READ, amount: '18.00' })).toEqual(['amount', 'currency'])
    expect(listChangedBillFields(READ, { ...READ, currency: 'USD' })).toEqual(['amount', 'currency'])
  })

  it('names the recurring switch beside a recurrence or an end, and neither beside the switch', () => {
    const recurring = { ...READ, isRecurring: true }

    expect(listChangedBillFields(recurring, { ...recurring, recurrence: 'YEARLY' })).toEqual([
      'isRecurring',
      'recurrence',
    ])
    expect(listChangedBillFields(recurring, { ...recurring, endsOn: '2027-06-30' })).toEqual(['isRecurring', 'endsOn'])
    expect(listChangedBillFields(READ, { ...READ, isRecurring: true })).toEqual(['isRecurring'])
  })
})
