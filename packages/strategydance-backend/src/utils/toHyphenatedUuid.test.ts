import { describe, expect, test } from 'bun:test'

import toHyphenatedUuid from './toHyphenatedUuid'

describe('toHyphenatedUuid', () => {
  test('hyphenates the 32 digits Data Connect writes', () => {
    expect(toHyphenatedUuid('0123456789abcdef0123456789abcdef')).toBe('01234567-89ab-cdef-0123-456789abcdef')
  })

  test('keeps a hyphenated UUID as it is, in lowercase', () => {
    expect(toHyphenatedUuid('01234567-89AB-CDEF-0123-456789ABCDEF')).toBe('01234567-89ab-cdef-0123-456789abcdef')
  })

  test('never reads as JSON, even when its digits are all decimal', () => {
    expect(() => JSON.parse(toHyphenatedUuid('12345678901234567890123456789012'))).toThrow()
    expect(() => JSON.parse(toHyphenatedUuid('1234567890e234567890123456789012'))).toThrow()
  })
})
