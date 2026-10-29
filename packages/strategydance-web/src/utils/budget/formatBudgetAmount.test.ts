import { describe, expect, it } from 'bun:test'

import formatBudgetAmount from '~utils/budget/formatBudgetAmount'

// Intl puts a no-break space between an amount and its sign
function withPlainSpaces(text: string) {
  return text.replace(/\s/g, ' ')
}

describe('formatBudgetAmount', () => {
  it('writes a sum in whole units, rounded', () => {
    expect(formatBudgetAmount(268123, 'USD', 'en-US')).toBe('$2,681')
    expect(formatBudgetAmount(31250, 'USD', 'en-US')).toBe('$313')
  })

  it('writes an exact amount to the digits of its currency', () => {
    expect(formatBudgetAmount(31240, 'USD', 'en-US', { exact: true })).toBe('$312.40')
    expect(formatBudgetAmount(1500, 'JPY', 'en-US', { exact: true })).toBe('¥1,500')
    expect(withPlainSpaces(formatBudgetAmount(1500, 'ISK', 'en-US', { exact: true }))).toBe('ISK 1,500')
  })

  it('writes the locale of the reader', () => {
    expect(withPlainSpaces(formatBudgetAmount(120000, 'EUR', 'de-DE', { exact: true }))).toBe('1.200,00 €')
  })
})
