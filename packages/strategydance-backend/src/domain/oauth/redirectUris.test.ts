import { describe, expect, test } from 'bun:test'

import isLoopbackRedirectUri from './isLoopbackRedirectUri'
import isValidRedirectUri from './isValidRedirectUri'
import matchesRedirectUri from './matchesRedirectUri'

describe('isLoopbackRedirectUri', () => {
  test('is http on this computer, on any port', () => {
    for (const uri of ['http://localhost/cb', 'http://127.0.0.1:43210/cb', 'http://[::1]:8080/callback']) {
      expect(isLoopbackRedirectUri(uri)).toBe(true)
    }

    for (const uri of [
      'https://localhost/cb',
      'http://localhost.example.com/cb',
      'http://10.0.0.1/cb',
      'cursor://cb',
    ]) {
      expect(isLoopbackRedirectUri(uri)).toBe(false)
    }
  })
})

describe('isValidRedirectUri', () => {
  test('takes https and loopback addresses', () => {
    expect(isValidRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true)
    expect(isValidRedirectUri('http://127.0.0.1:43210/callback?from=cli')).toBe(true)
  })

  test('takes loopback addresses alone for a registration', () => {
    expect(isValidRedirectUri('https://claude.ai/api/mcp/auth_callback', { isLoopbackOnly: true })).toBe(false)
    expect(isValidRedirectUri('http://localhost:6274/oauth/callback', { isLoopbackOnly: true })).toBe(true)
  })

  test('refuses a private-use scheme, plain http elsewhere, a fragment, a user and a response parameter', () => {
    for (const uri of [
      'cursor://anysphere.cursor-retrieval/oauth/callback',
      'http://example.com/cb',
      'https://example.com/cb#fragment',
      'https://user:pass@example.com/cb',
      'https://example.com/cb?code=1',
      'https://example.com/cb?state=1',
      'http://127.0.0.1/cb?iss=x',
      'https://example.com/cb?error=x',
      `https://example.com/${'a'.repeat(2048)}`,
      'not an address',
    ]) {
      expect(isValidRedirectUri(uri)).toBe(false)
    }
  })
})

describe('matchesRedirectUri', () => {
  test('matches a loopback address on any port, and everything else of it exactly', () => {
    const declared = ['http://127.0.0.1/callback', 'https://claude.ai/api/mcp/auth_callback']

    expect(matchesRedirectUri('http://127.0.0.1:43210/callback', declared)).toBe(true)
    expect(matchesRedirectUri('http://127.0.0.1/callback', declared)).toBe(true)
    expect(matchesRedirectUri('http://127.0.0.1:43210/other', declared)).toBe(false)
    expect(matchesRedirectUri('http://localhost:43210/callback', declared)).toBe(false)
    expect(matchesRedirectUri('http://127.0.0.1:43210/callback?x=1', declared)).toBe(false)
  })

  test('matches every other address character for character', () => {
    const declared = ['https://claude.ai/api/mcp/auth_callback']

    expect(matchesRedirectUri('https://claude.ai/api/mcp/auth_callback', declared)).toBe(true)
    expect(matchesRedirectUri('https://claude.ai/api/mcp/auth_callback/', declared)).toBe(false)
    expect(matchesRedirectUri('https://CLAUDE.ai/api/mcp/auth_callback', declared)).toBe(false)
    expect(matchesRedirectUri('https://claude.ai:443/api/mcp/auth_callback', declared)).toBe(false)
  })
})
