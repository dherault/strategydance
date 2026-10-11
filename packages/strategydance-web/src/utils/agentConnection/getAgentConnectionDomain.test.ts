import { describe, expect, test } from 'bun:test'

import getAgentConnectionDomain from './getAgentConnectionDomain'

describe('getAgentConnectionDomain', () => {
  test("is a client ID metadata document's domain", () => {
    expect(getAgentConnectionDomain('https://claude.ai/oauth/mcp-oauth-client-metadata')).toBe('claude.ai')
  })

  test('is null for a client that registered itself', () => {
    expect(getAgentConnectionDomain('0123456789abcdef0123456789abcdef')).toBeNull()
  })

  test('is null for an address that is not https', () => {
    expect(getAgentConnectionDomain('http://claude.ai/client.json')).toBeNull()
  })
})
