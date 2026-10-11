import { describe, expect, test } from 'bun:test'

import parseModuleResource from './parseModuleResource'

// The tests run as neither development nor production, under the development backend's issuer
describe('parseModuleResource', () => {
  test("names a module by its address under the issuer, in the address's one form", () => {
    expect(parseModuleResource('http://localhost:3003/mcp/knowledge')).toEqual({
      module: expect.objectContaining({ name: 'knowledge' }),
      resource: 'http://localhost:3003/mcp/knowledge',
    })
    expect(parseModuleResource('HTTP://LOCALHOST:3003/mcp/tasks')).toEqual({
      module: expect.objectContaining({ name: 'tasks' }),
      resource: 'http://localhost:3003/mcp/tasks',
    })
  })

  test('refuses anything else', () => {
    for (const value of [
      undefined,
      '',
      'not an address',
      'http://localhost:3003/mcp/budget',
      'http://localhost:3003/mcp/knowledge/',
      'http://localhost:3003/mcp/knowledge?x=1',
      'http://localhost:3003/mcp/knowledge?',
      'http://localhost:3003/mcp/knowledge#part',
      'http://user@localhost:3003/mcp/knowledge',
      'https://localhost:3003/mcp/knowledge',
      'http://localhost:3004/mcp/knowledge',
      'https://api.strategydance.com/mcp/knowledge',
      'http://localhost:3003/MCP/knowledge',
    ]) {
      expect(parseModuleResource(value)).toBeNull()
    }
  })
})
