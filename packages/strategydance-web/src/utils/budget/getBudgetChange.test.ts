import { describe, expect, it } from 'bun:test'

import getBudgetChange from '~utils/budget/getBudgetChange'

describe('getBudgetChange', () => {
  it('answers a whole percentage', () => {
    expect(getBudgetChange(150, 100)).toBe(50)
    expect(getBudgetChange(2, 3)).toBe(-33)
    expect(getBudgetChange(100, 100)).toBe(0)
  })

  it('answers nothing when there was nothing to compare with', () => {
    expect(getBudgetChange(100, 0)).toBeNull()
  })
})
