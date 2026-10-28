import { describe, expect, it } from 'bun:test'

import { MAX_MONEY_MINOR } from 'strategydance-core'

import formatAmountInput, { formatAmountPlaceholder } from '~utils/budget/formatAmountInput'
import readAmountInput from '~utils/budget/readAmountInput'

describe('readAmountInput', () => {
  it('reads a decimal point and a decimal comma alike', () => {
    expect(readAmountInput('12.50', 'EUR')).toEqual({ outcome: 'amount', amountMinor: 1250 })
    expect(readAmountInput('12,50', 'EUR')).toEqual({ outcome: 'amount', amountMinor: 1250 })
    expect(readAmountInput('12,5', 'EUR')).toEqual({ outcome: 'amount', amountMinor: 1250 })
    expect(readAmountInput('1500', 'JPY')).toEqual({ outcome: 'amount', amountMinor: 1500 })
  })

  it('drops spaces, the no-break ones a French keyboard groups thousands with included', () => {
    expect(readAmountInput(' 1 500,00 ', 'EUR')).toEqual({ outcome: 'amount', amountMinor: 150000 })
    expect(readAmountInput('1 500,00', 'EUR')).toEqual({ outcome: 'amount', amountMinor: 150000 })
    expect(readAmountInput('2 500', 'JPY')).toEqual({ outcome: 'amount', amountMinor: 2500 })
  })

  it('refuses thousands separators rather than guess which country wrote them', () => {
    expect(readAmountInput('1,500.00', 'USD')).toEqual({ outcome: 'grouped' })
    expect(readAmountInput('1.500,00', 'EUR')).toEqual({ outcome: 'grouped' })
    expect(readAmountInput('1,500', 'USD')).toEqual({ outcome: 'grouped' })
    expect(readAmountInput('1.500', 'EUR')).toEqual({ outcome: 'grouped' })
    expect(readAmountInput('1,000,000', 'JPY')).toEqual({ outcome: 'grouped' })
  })

  it('refuses more decimals than the currency has', () => {
    expect(readAmountInput('1500,5', 'JPY')).toEqual({ outcome: 'decimals' })
    expect(readAmountInput('12.5', 'ISK')).toEqual({ outcome: 'decimals' })
    expect(readAmountInput('12.5000', 'USD')).toEqual({ outcome: 'decimals' })
  })

  it('refuses nothing, zero, a sign, a symbol and a value past MAX_MONEY_MINOR', () => {
    expect(readAmountInput('', 'USD')).toEqual({ outcome: 'invalid' })
    expect(readAmountInput('0,00', 'USD')).toEqual({ outcome: 'invalid' })
    expect(readAmountInput('-12', 'USD')).toEqual({ outcome: 'invalid' })
    expect(readAmountInput('$12', 'USD')).toEqual({ outcome: 'invalid' })
    expect(readAmountInput(String(MAX_MONEY_MINOR + 1), 'JPY')).toEqual({ outcome: 'tooLarge' })
  })
})

describe('formatAmountInput', () => {
  it("writes an amount with the reader's decimal separator, which reads back to it", () => {
    expect(formatAmountInput(4500, 'USD', 'en')).toBe('45.00')
    expect(formatAmountInput(4500, 'EUR', 'fr')).toBe('45,00')
    expect(formatAmountInput(150000, 'EUR', 'de')).toBe('1500,00')
    expect(formatAmountInput(1500, 'JPY', 'fr')).toBe('1500')
    expect(readAmountInput(formatAmountInput(150000, 'EUR', 'de'), 'EUR')).toEqual({
      outcome: 'amount',
      amountMinor: 150000,
    })
  })

  it("shows the currency's digits in an empty field", () => {
    expect(formatAmountPlaceholder('USD', 'en')).toBe('0.00')
    expect(formatAmountPlaceholder('EUR', 'fr')).toBe('0,00')
    expect(formatAmountPlaceholder('JPY', 'fr')).toBe('0')
  })
})
