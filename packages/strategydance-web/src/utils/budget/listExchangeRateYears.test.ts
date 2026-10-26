import { describe, expect, it } from 'bun:test'

import listExchangeRateYears from '~utils/budget/listExchangeRateYears'

const TODAY = '2026-10-19'

describe('listExchangeRateYears', () => {
  it('reads this year and last year with no bill', () => {
    expect(listExchangeRateYears([], TODAY)).toEqual([2025, 2026])
  })

  it('adds the year of the last payment of each bill, once, in order', () => {
    expect(
      listExchangeRateYears(
        [
          { paidOn: '2021-06-01', recurrence: null, endsOn: null },
          { paidOn: '2019-03-02', recurrence: 'YEARLY', endsOn: '2022-12-31' },
          { paidOn: '2021-01-15', recurrence: null, endsOn: null },
        ],
        TODAY,
      ),
    ).toEqual([2021, 2022, 2025, 2026])
  })

  it('reads a recurring bill at its latest payment, and a future one at its first', () => {
    expect(
      listExchangeRateYears(
        [
          { paidOn: '2018-02-10', recurrence: 'MONTHLY', endsOn: null },
          { paidOn: '2027-01-05', recurrence: null, endsOn: null },
        ],
        TODAY,
      ),
    ).toEqual([2025, 2026, 2027])
  })
})
