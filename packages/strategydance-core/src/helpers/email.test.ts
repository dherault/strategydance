import { describe, expect, it } from 'bun:test'

import { isEmailAddress, normalizeEmailAddress } from './email'

describe('isEmailAddress', () => {
  it('accepts an address with a dotted domain', () => {
    expect(isEmailAddress('jane@company.com')).toBe(true)
    expect(isEmailAddress('jane.doe+team@mail.company.co.uk')).toBe(true)
  })

  it('refuses a missing part', () => {
    expect(isEmailAddress('jane')).toBe(false)
    expect(isEmailAddress('jane@')).toBe(false)
    expect(isEmailAddress('@company.com')).toBe(false)
    expect(isEmailAddress('jane@company')).toBe(false)
  })

  it('refuses whitespace and commas, which the invite field splits on', () => {
    expect(isEmailAddress('jane doe@company.com')).toBe(false)
    expect(isEmailAddress('jane@company.com,sam@company.com')).toBe(false)
    expect(isEmailAddress(' jane@company.com')).toBe(false)
  })

  it('refuses a second @', () => {
    expect(isEmailAddress('jane@doe@company.com')).toBe(false)
  })
})

describe('normalizeEmailAddress', () => {
  it('trims and lowercases, as Firebase Auth does to the address on a token', () => {
    expect(normalizeEmailAddress('  Jane.Doe@Company.COM ')).toBe('jane.doe@company.com')
  })
})
