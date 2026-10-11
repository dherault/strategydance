import { describe, expect, test } from 'bun:test'

import buildAuthorizationResponseUrl from './buildAuthorizationResponseUrl'

describe('buildAuthorizationResponseUrl', () => {
  test('appends the answer to the redirect address', () => {
    expect(
      buildAuthorizationResponseUrl('http://127.0.0.1:43210/callback', {
        code: 'abc',
        state: 's t',
        iss: 'http://localhost:3003',
      }),
    ).toBe('http://127.0.0.1:43210/callback?code=abc&state=s+t&iss=http%3A%2F%2Flocalhost%3A3003')
  })

  test("keeps the address's own query byte for byte", () => {
    expect(buildAuthorizationResponseUrl('https://example.com/cb?from=a%20b&x', { code: 'abc' })).toBe(
      'https://example.com/cb?from=a%20b&x&code=abc',
    )
    expect(buildAuthorizationResponseUrl('https://example.com/cb?', { code: 'abc' })).toBe(
      'https://example.com/cb?code=abc',
    )
  })

  test('leaves out a state the client never sent', () => {
    expect(
      buildAuthorizationResponseUrl('https://example.com/cb', { error: 'access_denied', state: null, iss: 'i' }),
    ).toBe('https://example.com/cb?error=access_denied&iss=i')
  })
})
