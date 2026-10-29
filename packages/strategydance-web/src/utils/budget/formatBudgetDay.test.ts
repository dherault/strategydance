import { describe, expect, it } from 'bun:test'

import formatBudgetDay from '~utils/budget/formatBudgetDay'

const TODAY = '2026-10-26'

describe('formatBudgetDay', () => {
  it('leaves this year out', () => {
    expect(formatBudgetDay('2026-10-28', TODAY, 'en-US')).toBe('Oct 28')
  })

  it('writes another year', () => {
    expect(formatBudgetDay('2027-01-01', TODAY, 'en-US')).toBe('Jan 1, 2027')
    expect(formatBudgetDay('2025-12-31', TODAY, 'en-US')).toBe('Dec 31, 2025')
  })

  it('writes this year when asked', () => {
    expect(formatBudgetDay('2026-11-25', TODAY, 'en-US', { withYear: true })).toBe('Nov 25, 2026')
  })
})
