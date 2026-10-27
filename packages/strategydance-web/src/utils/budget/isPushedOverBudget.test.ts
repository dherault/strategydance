import { describe, expect, it } from 'bun:test'

import { type BudgetBill, buildExchangeRateTable } from 'strategydance-core'

import isPushedOverBudget from '~utils/budget/isPushedOverBudget'

const TODAY = '2026-10-19'
const BUDGET = { amountMinor: 10000, period: 'MONTHLY' as const }
const RATES = buildExchangeRateTable([])

function makeBill(id: string, amountMinor: number, currency: BudgetBill['currency'] = 'USD'): BudgetBill {
  return {
    id,
    name: id,
    company: 'Company',
    amountMinor,
    currency,
    paidOn: '2026-10-05',
    recurrence: null,
    endsOn: null,
  }
}

const SPENT = [makeBill('rent', 9000)]
const COMPUTATION = { budget: BUDGET, currency: 'USD' as const, today: TODAY, rates: RATES }

describe('isPushedOverBudget', () => {
  it('says so of a bill taking this month past its budget', () => {
    expect(isPushedOverBudget({ ...COMPUTATION, bills: SPENT, bill: makeBill('ads', 2000) })).toBe(true)
  })

  it('says so of an edit taking a bill past it', () => {
    const bills = [...SPENT, makeBill('ads', 500)]

    expect(isPushedOverBudget({ ...COMPUTATION, bills, bill: makeBill('ads', 1500) })).toBe(true)
    expect(isPushedOverBudget({ ...COMPUTATION, bills, bill: makeBill('ads', 900) })).toBe(false)
  })

  it('says nothing once spending was over already, or with no budget', () => {
    const over = [makeBill('rent', 11000)]

    expect(isPushedOverBudget({ ...COMPUTATION, bills: over, bill: makeBill('ads', 2000) })).toBe(false)
    expect(isPushedOverBudget({ ...COMPUTATION, budget: null, bills: SPENT, bill: makeBill('ads', 2000) })).toBe(false)
  })

  it('says nothing of a bill whose currency has no rate yet', () => {
    expect(isPushedOverBudget({ ...COMPUTATION, bills: SPENT, bill: makeBill('ads', 2000, 'JPY') })).toBe(false)
  })
})
