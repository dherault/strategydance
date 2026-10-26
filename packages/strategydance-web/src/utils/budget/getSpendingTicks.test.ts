import { describe, expect, it } from 'bun:test'

import getSpendingTicks from '~utils/budget/getSpendingTicks'

describe('getSpendingTicks', () => {
  it('steps round amounts past the highest month and the budget', () => {
    expect(getSpendingTicks([1589, 3776, 4015], 2500)).toEqual([0, 1000, 2000, 3000, 4000, 5000])
  })

  it('reaches past the budget when it is the highest', () => {
    expect(getSpendingTicks([100, 300], 2500).at(-1)).toBeGreaterThan(2500)
  })

  it('spans a few units on a year of zeros', () => {
    expect(getSpendingTicks(Array(12).fill(0), null)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
