import { describe, expect, test } from 'bun:test'

import checkClientIdUrl from './checkClientIdUrl'
import isRegisteredClientId from './isRegisteredClientId'

describe('checkClientIdUrl', () => {
  test('takes an https address with a path, as the URL parser writes it', () => {
    expect(checkClientIdUrl('https://claude.ai/oauth/mcp-oauth-client-metadata')).toBe(true)
    expect(checkClientIdUrl('https://example.com/client.json?v=1')).toBe(true)
  })

  test('refuses an address with no path, another scheme or port, a user, a fragment or a dot segment', () => {
    for (const clientId of [
      'https://example.com',
      'https://example.com/',
      'http://example.com/client.json',
      'https://example.com:8443/client.json',
      'https://user@example.com/client.json',
      'https://example.com/client.json#part',
      'https://example.com/a/../client.json',
      'https://example.com/./client.json',
      'https://EXAMPLE.com/client.json',
      `https://example.com/${'a'.repeat(2048)}`,
      'cursor',
    ]) {
      expect(checkClientIdUrl(clientId)).toBe(false)
    }
  })
})

describe('isRegisteredClientId', () => {
  test('is 32 lowercase hex digits and no other spelling', () => {
    expect(isRegisteredClientId('0123456789abcdef0123456789abcdef')).toBe(true)
    expect(isRegisteredClientId('01234567-89ab-cdef-0123-456789abcdef')).toBe(false)
    expect(isRegisteredClientId('0123456789ABCDEF0123456789ABCDEF')).toBe(false)
    expect(isRegisteredClientId('https://example.com/client.json')).toBe(false)
  })
})
