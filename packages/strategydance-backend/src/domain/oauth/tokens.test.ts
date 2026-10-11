import { describe, expect, test } from 'bun:test'

import createOpaqueToken from './createOpaqueToken'
import deriveSuccessorTokens from './deriveSuccessorTokens'
import hashOAuthToken from './hashOAuthToken'

describe('createOpaqueToken', () => {
  test('draws 256 random bits in base64url', () => {
    const token = createOpaqueToken()

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(createOpaqueToken()).not.toBe(token)
  })
})

describe('hashOAuthToken', () => {
  test("is the token's SHA-256 in base64url", () => {
    expect(hashOAuthToken('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0')
  })
})

describe('deriveSuccessorTokens', () => {
  test('derives the same pair from the same token under the same secret, its two tokens differing', () => {
    const pair = deriveSuccessorTokens('spent', 'secret')

    expect(deriveSuccessorTokens('spent', 'secret')).toEqual(pair)
    expect(pair.accessToken).not.toBe(pair.refreshToken)
    expect(pair.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  test('derives another pair from another token, or under another secret', () => {
    const pair = deriveSuccessorTokens('spent', 'secret')

    expect(deriveSuccessorTokens('other', 'secret').accessToken).not.toBe(pair.accessToken)
    expect(deriveSuccessorTokens('spent', 'rotated').refreshToken).not.toBe(pair.refreshToken)
  })
})
