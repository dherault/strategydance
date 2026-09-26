import { describe, expect, it } from 'bun:test'

import parseBearerToken from './parseBearerToken'

describe('parseBearerToken', () => {
  it('reads the token after the prefix', () => {
    expect(parseBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('answers null for a missing header or another scheme', () => {
    expect(parseBearerToken(undefined)).toBeNull()
    expect(parseBearerToken(null)).toBeNull()
    expect(parseBearerToken('Basic dXNlcjpwYXNz')).toBeNull()
  })

  it('answers null for a prefix with nothing after it', () => {
    expect(parseBearerToken('Bearer ')).toBeNull()
  })
})
