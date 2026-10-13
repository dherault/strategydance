import { describe, expect, test } from 'bun:test'

import isQuotedIn from '~domain/directories/isQuotedIn'

const TEXT = 'Submit your tool for FREE. Free listings wait about 30 days — skip the line for $19. “No AI wrappers”.'

describe('isQuotedIn', () => {
  test('finds a quote whatever its case, spaces, quotation marks and dashes', () => {
    expect(isQuotedIn('free listings wait   about 30 days - skip the line', TEXT)).toBe(true)
    expect(isQuotedIn('"No AI wrappers"', TEXT)).toBe(true)
  })

  test('finds each piece around an ellipsis, in order', () => {
    expect(isQuotedIn('Free listings wait … for $19', TEXT)).toBe(true)
    expect(isQuotedIn('for $19 ... Free listings wait', TEXT)).toBe(false)
  })

  test('refuses what the text does not hold, and a quote too short to prove anything', () => {
    expect(isQuotedIn('Listings are paid only', TEXT)).toBe(false)
    expect(isQuotedIn('free', TEXT)).toBe(false)
  })
})
