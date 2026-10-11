import { describe, expect, test } from 'bun:test'

import parseOAuthConsentRequestId from './parseOAuthConsentRequestId'

describe('parseOAuthConsentRequestId', () => {
  test('takes a hyphenated UUID, as the backend writes it', () => {
    expect(parseOAuthConsentRequestId('01234567-89ab-cdef-0123-456789abcdef')).toBe(
      '01234567-89ab-cdef-0123-456789abcdef',
    )
  })

  test('takes 32 hex digits, as Data Connect writes a UUID', () => {
    expect(parseOAuthConsentRequestId('0123456789ABCDEF0123456789abcdef')).toBe('0123456789ABCDEF0123456789abcdef')
  })

  test('names nothing for what is not a UUID', () => {
    for (const value of [
      '',
      'consent',
      '0123456789abcdef',
      '01234567-89ab-cdef-0123-456789abcdeg',
      ' 01234567-89ab-cdef-0123-456789abcdef',
    ]) {
      expect(parseOAuthConsentRequestId(value)).toBeUndefined()
    }
  })

  test('names nothing for a value the router parsed as JSON', () => {
    for (const value of [undefined, null, true, 1e31, ['01234567-89ab-cdef-0123-456789abcdef']]) {
      expect(parseOAuthConsentRequestId(value)).toBeUndefined()
    }
  })
})
