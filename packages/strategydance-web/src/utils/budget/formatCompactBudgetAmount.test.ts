import { describe, expect, it } from 'bun:test'

import formatCompactBudgetAmount from '~utils/budget/formatCompactBudgetAmount'

describe('formatCompactBudgetAmount', () => {
  it('writes an amount short, to one decimal', () => {
    expect(formatCompactBudgetAmount(250000, 'USD', 'en-US')).toBe('$2.5K')
    expect(formatCompactBudgetAmount(0, 'USD', 'en-US')).toBe('$0')
    expect(formatCompactBudgetAmount(1200000, 'JPY', 'en-US')).toBe('¥1.2M')
  })
})
