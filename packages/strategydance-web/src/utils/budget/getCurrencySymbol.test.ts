import { describe, expect, it } from 'bun:test'

import getCurrencySymbol from '~utils/budget/getCurrencySymbol'

describe('getCurrencySymbol', () => {
  it('answers the narrow symbol', () => {
    expect(getCurrencySymbol('USD', 'en-US')).toBe('$')
    expect(getCurrencySymbol('CAD', 'en-US')).toBe('$')
    expect(getCurrencySymbol('EUR', 'fr')).toBe('€')
    expect(getCurrencySymbol('JPY', 'en-US')).toBe('¥')
  })
})
