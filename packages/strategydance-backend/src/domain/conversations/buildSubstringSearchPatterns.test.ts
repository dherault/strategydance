import { describe, expect, test } from 'bun:test'

import buildSubstringSearchPatterns from './buildSubstringSearchPatterns'

describe('buildSubstringSearchPatterns', () => {
  test('makes one pattern a word, and fills the rest with what matches any text', () => {
    expect(buildSubstringSearchPatterns(['定价', '策略'])).toEqual({
      pattern0: '%定价%',
      pattern1: '%策略%',
      pattern2: '%',
      pattern3: '%',
      pattern4: '%',
      pattern5: '%',
      pattern6: '%',
      pattern7: '%',
    })
  })

  test('escapes what LIKE reads, so a word matches only itself', () => {
    const { pattern0, pattern1, pattern2 } = buildSubstringSearchPatterns(['100%', 'sure_thing', 'a\\b'])

    expect(pattern0).toBe('%100\\%%')
    expect(pattern1).toBe('%sure\\_thing%')
    expect(pattern2).toBe('%a\\\\b%')
  })

  test('refuses more words than a search holds', () => {
    expect(() => buildSubstringSearchPatterns(Array.from({ length: 9 }, (_, index) => `w${index}`))).toThrow()
  })
})
