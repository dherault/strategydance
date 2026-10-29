import { describe, expect, it } from 'bun:test'

import { buildExchangeRateTable } from 'strategydance-core'

import getLatestExchangeRateDay from '~utils/budget/getLatestExchangeRateDay'

describe('getLatestExchangeRateDay', () => {
  it('answers the latest day of any currency', () => {
    expect(
      getLatestExchangeRateDay(
        buildExchangeRateTable([
          { currency: 'USD', year: 2026, rates: JSON.stringify({ '2026-10-23': 1.16, '2026-10-26': 1.17 }) },
          { currency: 'JPY', year: 2026, rates: JSON.stringify({ '2026-10-23': 175 }) },
        ]),
      ),
    ).toBe('2026-10-26')
  })

  it('answers nothing when no rate was read', () => {
    expect(getLatestExchangeRateDay(buildExchangeRateTable([]))).toBeNull()
  })
})
