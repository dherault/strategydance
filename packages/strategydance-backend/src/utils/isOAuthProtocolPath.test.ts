import { describe, expect, test } from 'bun:test'

import isOAuthProtocolPath from './isOAuthProtocolPath'

describe('isOAuthProtocolPath', () => {
  test("is one of the protocol's own endpoints, as Express routes it", () => {
    for (const path of [
      '/.well-known/oauth-authorization-server',
      '/oauth/register',
      '/oauth/authorize',
      '/oauth/token',
      '/oauth/token/',
      '/OAuth/Token',
      '/oauth/revoke',
    ]) {
      expect(isOAuthProtocolPath(path)).toBe(true)
    }
  })

  test("is nothing else, the consent page's routes included", () => {
    for (const path of [
      '/oauth',
      '/oauth/',
      '/oauth/requests/abc',
      '/oauth/requests/abc/approve',
      '/oauth/token//',
      '/oauth/tokens',
      '/organizations',
      '/',
    ]) {
      expect(isOAuthProtocolPath(path)).toBe(false)
    }
  })
})
