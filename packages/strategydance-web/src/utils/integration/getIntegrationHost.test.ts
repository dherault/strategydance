import { describe, expect, test } from 'bun:test'

import getIntegrationHost from './getIntegrationHost'

describe('getIntegrationHost', () => {
  test("reads an address's host, and gives back what is no address", () => {
    expect(getIntegrationHost('https://mcp.linear.app/mcp')).toBe('mcp.linear.app')
    expect(getIntegrationHost('not an address')).toBe('not an address')
  })
})
