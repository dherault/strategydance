import { describe, expect, it } from 'bun:test'

import getBillRepeatState from '~utils/budget/getBillRepeatState'

const TODAY = '2026-10-19'

describe('getBillRepeatState', () => {
  it('says a bill paid once is one-time, whenever it is paid', () => {
    expect(getBillRepeatState({ paidOn: '2026-01-10', recurrence: null, endsOn: null }, TODAY)).toBe('oneTime')
    expect(getBillRepeatState({ paidOn: '2026-12-10', recurrence: null, endsOn: null }, TODAY)).toBe('oneTime')
  })

  it('says a bill with a payment to come recurs', () => {
    expect(getBillRepeatState({ paidOn: '2026-01-10', recurrence: 'MONTHLY', endsOn: null }, TODAY)).toBe('recurring')
    expect(getBillRepeatState({ paidOn: '2026-01-10', recurrence: 'MONTHLY', endsOn: '2026-11-10' }, TODAY)).toBe(
      'recurring',
    )
  })

  it('says a bill that made its last payment has ended', () => {
    expect(getBillRepeatState({ paidOn: '2026-01-10', recurrence: 'MONTHLY', endsOn: '2026-10-19' }, TODAY)).toBe(
      'ended',
    )
    expect(getBillRepeatState({ paidOn: '2025-03-01', recurrence: 'QUARTERLY', endsOn: '2026-09-30' }, TODAY)).toBe(
      'ended',
    )
  })

  it('says a bill whose first payment is years ahead recurs', () => {
    expect(getBillRepeatState({ paidOn: '2029-06-01', recurrence: 'YEARLY', endsOn: null }, TODAY)).toBe('recurring')
  })
})
