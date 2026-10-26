import { describe, expect, it } from 'bun:test'

import toSpendingTooltipRows from '~utils/budget/toSpendingTooltipRows'

const MONTH = { name: 'Oct', value: 4015.58, spent: 268123, expected: 133435 }

describe('toSpendingTooltipRows', () => {
  it('lists what was spent and what is expected', () => {
    expect(toSpendingTooltipRows(MONTH).map(({ name, value }) => [name, value])).toEqual([
      ['spent', 268123],
      ['expected', 133435],
    ])
  })

  it('leaves out what the month does not hold', () => {
    expect(toSpendingTooltipRows({ ...MONTH, expected: 0 }).map(({ name }) => name)).toEqual(['spent'])
  })

  it('says there is nothing when the month holds nothing', () => {
    expect(toSpendingTooltipRows({ ...MONTH, value: 0, spent: 0, expected: 0 }).map(({ name }) => name)).toEqual([
      'nothing',
    ])
  })
})
